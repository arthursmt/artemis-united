---
name: guardrail-check
description: Verifica se uma mudança respeita as fronteiras arquiteturais e decisões já fechadas do Artemis United (fronteira ECOA, isolamento do bob-engine, moeda USD, PII/dinheiro exato em analytics, tokens de cor). Use antes de considerar pronta qualquer mudança que toque auth, customer-profile, businesses, financial-statements, bob-engine, analytics, ou estilo/CSS de apps/web — e sempre que o usuário pedir uma "varredura", "auditoria" ou "checagem de guardrails" do projeto.
---

# Checklist de guardrails do Artemis United

Estas são decisões já fechadas (plano mestre / docs/architecture.md /
bob-engine-parametros-setoriais.md) que já foram violadas ou quase foram em
sessões anteriores. Cada item abaixo é um `grep` dirigido, não uma leitura
visual — a fronteira ECOA, por exemplo, só foi confirmada com segurança em
sessões passadas rodando o grep de verdade, não por inspeção de olho.

Rode os itens relevantes ao que você mudou (não precisa rodar todos sempre).

## 1. Fronteira ECOA — dado de onboarding-cliente nunca chega ao bob-engine

Decisão #16 do plano mestre: estado civil, filhos, composição familiar não
podem influenciar risco de crédito sem revisão legal (ECOA). Nenhum campo de
`customer_profiles` pode aparecer em `bob-engine` nem no payload que
`apps/api` envia pra ele.

```bash
grep -rn "customerProfile\|maritalStatus\|dateOfBirth\|hasChildren\|householdSize" \
  apps/api/src/lib/bobEngineClient.ts \
  apps/api/src/routes/financialStatements.ts \
  apps/api/src/routes/assessments.ts \
  services/bob-engine/src
```

Esperado: zero ocorrências. Qualquer match é bloqueador.

## 2. `bob-engine` nunca faz JOIN nem query direta em tabelas de `app`

Decisão de arquitetura (docs/architecture.md §1.2): `bob-engine` só persiste
o que é dele (`schema bob`), nunca lê `app.*` diretamente — a fronteira é a
API HTTP entre `apps/api` e `bob-engine`, não acesso a banco compartilhado.

```bash
grep -rn "app\.\(users\|businesses\|customer_profiles\|financial_statements\)" services/bob-engine/src
```

Esperado: zero ocorrências fora de comentários explicando a regra.

## 3. Moeda: default `USD`, nunca `BRL`

Correção já registrada (decisão #23) depois de um drift real (`docs/architecture.md`
nota de revisão). Confirme que nenhuma migration ou schema novo reintroduz
`BRL` como default.

```bash
grep -rn "'BRL'\|\"BRL\"\|default.*brl" apps/api/src/db apps/api/drizzle services/bob-engine/src/db services/bob-engine/drizzle
```

Esperado: zero ocorrências.

## 4. Analytics — nunca PII nem valor financeiro exato em propriedade de evento

Decisão #36: `packages/analytics` é desenhado pra tornar isso
estruturalmente impossível (união de eventos tipada), mas confirme que
nenhuma chamada de `track()` nova em `apps/web` passa `email`, `name`,
endereço, ou um valor monetário exato (sempre deveria ser faixa/bracket).

```bash
grep -rn "track(" apps/web/src | grep -iv "test"
```

Leia cada resultado — procure por `email:`, `name:`, `amount:` com número
cru, ou qualquer campo que pareça PII direta na propriedade do evento.

## 5. Paleta — sem cor hardcoded fora dos tokens

Decisão #20/#26: cores vêm só de `apps/web/src/index.css` (variáveis CSS).
CTA dourado (`--accent`, `#F8B61A`), quando existir como componente próprio,
sempre com texto navy — nunca branco.

```bash
grep -rn "#[0-9a-fA-F]\{3,6\}\|rgb(\|rgba(" apps/web/src --include="*.tsx" --include="*.css" | grep -v "apps/web/src/index.css"
```

Esperado: zero ocorrências (ou só em assets SVG, que não contam).

## 6. Decisões fechadas que não se reabrem sem autorização explícita

Não propor nem implementar sem o usuário pedir de forma explícita:
- WACC clássico no lugar da fórmula via DSCR-alvo (Seção 3 do documento de
  parâmetros — "decisão fechada, não reabrir sem justificativa nova").
- Regra de fallback de setor sem parâmetro (calcular sem o parâmetro, nunca
  inventar um valor).
- Trocar sessão por token opaco (decisão #18) por JWT ou lib de auth
  terceira.
- Redesenhar a paleta de cores (só reaplicar os tokens já definidos).

Se alguma correção parecer exigir mexer em um desses pontos, é sinal de que
o problema real é outro — pare e diagnostique de novo antes de tocar na
decisão fechada.

## Se algo falhar

Não corrija silenciosamente uma violação de guardrail como se fosse um bug
qualquer — ela geralmente indica um problema de desenho maior (ex: um dado
sendo passado por um caminho que não deveria existir). Reporte o achado
explicitamente antes de decidir a correção.
