# Seção 7 — Dados e Analytics — brief de implementação para o Claude Code

> Contexto: ler `docs/architecture.md` antes de qualquer coisa, se ainda não estiver carregado na sessão. Isso implementa a seção 7 do plano mestre — PostHog para analytics comportamental, Metabase local para métricas de negócio direto no schema `bob`, e uma camada de tipos que torna estruturalmente impossível vazar PII ou valor financeiro exato em evento de analytics.

---

## 1. Papel `metabase_readonly` no Postgres (Neon)

Criar como migration em `services/bob-engine` (ou onde as migrations do schema `bob` já vivem), aplicar em staging e prod (não precisa em dev local a menos que eu queira testar o dashboard localmente contra dado de dev):

```sql
-- Read-only, escopo travado no schema bob. Nunca acesso ao schema app (sem PII).
CREATE ROLE metabase_readonly WITH LOGIN PASSWORD '<gerar senha forte, guardar como segredo>';
GRANT CONNECT ON DATABASE <nome_do_banco> TO metabase_readonly;
GRANT USAGE ON SCHEMA bob TO metabase_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA bob TO metabase_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA bob GRANT SELECT ON TABLES TO metabase_readonly;
REVOKE ALL ON SCHEMA app FROM metabase_readonly;
```

A senha gerada vai para o `.env` local (dev) como `METABASE_DB_PASSWORD` — nunca commitada.

## 2. Metabase local via docker-compose

Adicionar ao `docker-compose.yml` existente (não substituir, adicionar um serviço novo):

```yaml
  metabase:
    image: metabase/metabase:latest
    ports:
      - "3001:3000"
    environment:
      MB_DB_TYPE: postgres
      MB_DB_DBNAME: <nome_do_banco>
      MB_DB_PORT: 5432
      MB_DB_USER: metabase_readonly
      MB_DB_PASS: ${METABASE_DB_PASSWORD}
      MB_DB_HOST: <host do branch Neon staging ou prod, não o Postgres local>
```

Nota: o Metabase aqui só guarda a própria configuração num container local — a conexão de dado é sempre com o Neon remoto (staging/prod), via `metabase_readonly`. Não é pra conectar no Postgres do docker-compose de dev.

## 3. Pacote de eventos tipados (`packages/analytics`)

Novo pacote no monorepo, consumido só por `apps/web`. Objetivo: schema de evento com union discriminada — se um campo não está no tipo, não compila. É isso que impede `income: 4200` de existir em qualquer lugar do código, em vez de depender de revisão manual.

```typescript
// packages/analytics/src/events.ts

export type AnalyticsEvent =
  | { name: 'signup_step_completed'; properties: { step: 'personal_info' | 'business_info' | 'password'; step_index: number } }
  | { name: 'dre_block_completed'; properties: { block: 'revenue' | 'direct_costs' | 'operating_expenses' | 'business_debt' | 'personal_income' | 'personal_expenses'; block_index: number } }
  | { name: 'dre_block_abandoned'; properties: { block: string; block_index: number; time_spent_seconds: number } }
  | { name: 'assessment_completed'; properties: { confidence_level: number; sector_segment: string } }
  | { name: 'bob_chat_interaction'; properties: { category: 'recommendation_question' | 'simulation_request' | 'general_question' } }
  | { name: 'institution_connection_result'; properties: { status: 'success' | 'error' | 'pending'; institution_category: string } }
  | { name: 'recommendation_clicked'; properties: { institution_category: string } }
  | { name: 'two_factor_enabled'; properties: Record<string, never> }
  | { name: 'error_occurred'; properties: { journey: string; error_type: string } };
```

```typescript
// packages/analytics/src/track.ts
import posthog from 'posthog-js';
import type { AnalyticsEvent } from './events';

export function track(event: AnalyticsEvent) {
  posthog.capture(event.name, event.properties);
}
```

Regra a documentar em comentário no topo do arquivo `events.ts`, para qualquer sessão futura de Code que for adicionar um evento novo: **nunca adicionar um campo de valor financeiro exato (usar faixa/bracket) nem campo de PII (nome, email, endereço — usar apenas IDs internos já existentes) a uma properties. Se a propriedade parecer PII ou dinheiro exato, é sinal de que o evento está desenhado errado.**

## 4. Inicialização do PostHog (`apps/web`)

```typescript
// apps/web/src/lib/posthog.ts
import posthog from 'posthog-js';

posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
  api_host: import.meta.env.VITE_POSTHOG_HOST,
  person_profiles: 'identified_only',
});

export default posthog;
```

Instalar: `posthog-js` em `apps/web`.

## 5. Onde plugar os eventos (usar os wireframes já existentes em `docs/designpowers/wireframes/`)

- `signup_step_completed` — nas 3 etapas de Cadastro (task2-cadastro.md)
- `dre_block_completed` / `dre_block_abandoned` — nas 6 telas de bloco do DRE (task5-dre.md) — `dre_block_abandoned` dispara em `beforeunload`/navegação pra fora sem ter salvo aquele bloco, com `time_spent_seconds` medido desde a entrada na tela
- `assessment_completed` com `confidence_level` — no momento em que `bob.assessments` recebe uma nova linha (o campo já existe na tabela, decisão 23 do plano — só precisa também virar evento)
- `bob_chat_interaction` — no chat (task7-chat-bob.md), categorização acontece depois de uma checagem simples de intenção, nunca manda a mensagem crua
- `institution_connection_result` / `recommendation_clicked` — telas de conexão bancária (task9-instituicoes.md)
- `two_factor_enabled` — em Configurações → Segurança
- `error_occurred` — em qualquer boundary de erro já existente nas telas

## 6. Não fazer

- Não criar conta PostHog nem gerar API key — isso já foi feito manualmente (ver `.env.example` esperado)
- Não deployar Metabase no Railway/Render — fica local via docker-compose por ora
- Não dar ao `metabase_readonly` acesso ao schema `app` sob nenhuma circunstância
