# Artemis United + BoB — Arquitetura e Segurança (referência para Claude Code)

> Extraído do plano mestre do projeto em 2026-07-19. Este arquivo existe para que sessões de Claude Code tenham acesso às decisões já tomadas, em vez de inferir schema/contratos do zero. Se o plano mestre mudar, atualize este arquivo também.

---

## 1. Arquitetura 🟡

**Decidido:**
- Monorepo com Turborepo, hospedado no GitHub
- Estrutura: `apps/web` (Artemis United), `apps/api` (BFF), `services/bob-engine` (motor de underwriting isolado)
- `bob-engine` não conhece o conceito de "usuário Artemis" — recebe dados financeiros, devolve score/recomendação
- `packages/shared-types` para contratos de API compartilhados

### 1.1 Contrato de API: REST, não SOAP

SOAP fica fora — é XML verboso, contrato rígido via WSDL, geração de integração bancária que hoje só sobrevive em sistemas legados. Não há racional para adotar em um projeto novo em 2026.

**Proposta: REST + JSON, contract-first via OpenAPI 3.x**
- `packages/shared-types` deixa de ser só tipos TS soltos e passa a ser gerado a partir de um `openapi.yaml` único — API e web consomem o mesmo contrato, sem drift entre front e back.
- Versionamento por path: `/v1/assessments`, não por header — mais simples de debugar e de expor futuramente a parceiros B2B (bancos vão preferir isso).
- Endpoints centrais do `bob-engine` (rascunho, a refinar):
  - `POST /v1/assessments` — recebe snapshot financeiro (DRE + dívida atual), devolve recomendação de capital ótimo + score
  - `GET /v1/assessments/{id}` — recupera assessment já calculado
  - `POST /v1/assessments/{id}/refine` — envia dados adicionais para refinar uma recomendação existente

### 1.2 Modelagem de dados (proposta inicial)

Schema `app` (dados do usuário/negócio, propriedade do `api`):
- `users` — identidade, credenciais, contato
- `businesses` — dados do negócio, 1:1 ou 1:N com `users` (permitir múltiplos negócios por usuário no futuro, mesmo que V1 trave em 1)
- `financial_statements` — snapshots versionados do DRE (nunca sobrescrever — cada atualização gera nova linha com timestamp, é histórico que alimenta o BoB)
- `institution_connections` — vínculo do usuário com instituições financeiras conectadas (Plaid/Open Finance — ver 1.3)

Schema `bob` (propriedade do `bob-engine`, alimentado via API, não acesso direto a `app`):
- `assessments` — cada rodada de cálculo: inputs recebidos, outputs (score, capital ótimo, confiança), timestamp, e **parâmetros de segmentação usados** (ramo/setor)
- `assessment_refinements` — histórico de dados adicionais pedidos/recebidos por assessment
- `institution_offers` — ofertas de crédito de terceiros usadas nas comparações (cache local, não fonte de verdade)
- `assessment_outcomes` — **nova, crítica para evolução futura**: registra o que aconteceu depois da recomendação (usuário tomou o crédito sugerido? em qual instituição? houve inadimplência? negócio segue ativo N meses depois?). Sem essa tabela, não existe caminho para modelo aprendido no futuro — é o dado de "resultado" que falta para qualquer ML de crédito funcionar. Fica vazia/pouco populada no início, mas o schema precisa existir desde o V1.

Ponto de disciplina: `bob-engine` nunca faz `JOIN` direto nas tabelas de `app`. Ele recebe payload via API e persiste só o que é dele. É isso que mantém a fronteira real, não só de código.

### 1.3 Conexões externas — duas integrações diferentes, não uma

Você pediu duas coisas que parecem parecidas mas são **categorias de problema diferentes**:

**(a) Conectar a apps financeiros do usuário (tipo Guiabolso)** — isso é **agregação de conta bancária** (account aggregation / open banking). Nos EUA o equivalente ao Guiabolso é resolvido por provedores como **Plaid**, **MX** ou **Finicity (Mastercard)** — eles fazem a ponte com milhares de bancos e devolvem transações via uma API só. Isso é uma integração técnica direta: você assina Plaid, integra uma vez, e tem acesso a saldo/transações de qualquer banco que o usuário conectar. **Recomendo Plaid** — é o padrão de mercado nos EUA, documentação madura, e tem produto específico para exatamente esse caso (`Transactions`, `Assets`).

**(b) Simulações externas de outras instituições financeiras (comparação de ofertas)** — isso **não é uma integração técnica simples**. Não existe um "Plaid de taxas de crédito" universal — cada instituição que você quiser comparar precisa de parceria própria ou de um agregador de originação de crédito B2B (existem no mercado americano, a pesquisar caso a caso). **Isso é trabalho de parceria comercial, não só engenharia** — sinalizo para não subestimar o esforço achando que é "só conectar uma API".

**Decidido**: Plaid fica fora do V1 — entra como projeto adicional, depois que o B2C provar tração com dados inseridos manualmente via DRE. Reduz escopo de integração externa no lançamento inicial.

### 1.4 Estratégia de autenticação (três problemas, não um)

Você propôs "API Key ou proxy reverso" — vou separar em três camadas, porque são decisões independentes:

| Camada | Quem autentica | Proposta |
|---|---|---|
| Usuário final → `api` | Pessoa logando no Artemis United | Sessão via token opaco (não JWT) — hash SHA-256 armazenado em tabela `sessions` no Postgres, cookie httpOnly, validação e renovação de expiração no servidor (padrão Lucia, implementado manualmente, sem dependência de lib) |
| `api` → `bob-engine` | Serviço interno chamando serviço interno | Rede privada do Railway/Render (não exposto à internet) + shared secret simples no header — não precisa de mTLS no estágio atual |
| Futuro parceiro B2B (banco) → `bob-engine` | Terceiro externo | API Key por cliente, com rate limiting, atrás de um API Gateway/reverse proxy (aqui sua ideia de proxy reverso encaixa certo) |

O proxy reverso faz mais sentido como fronteira do B2B futuro, não como mecanismo de auth do usuário comum. Quando chegar a hora de vender o `bob-engine` a bancos, um gateway na frente do `bob-engine` já isolado resolve rate limiting, API keys por cliente e billing de uso — sem tocar no código do motor.

---

## 2. Segurança 🟡

**Decidido:**
- Senha local: 8+ caracteres, numeral, caractere especial, maiúsculas e minúsculas — nota técnica: guidelines atuais do NIST (800-63B) recomendam priorizar comprimento sobre complexidade forçada (regras de complexidade levam a padrões previsíveis tipo "Senha123!"). Mantenho sua regra por ser padrão de mercado reconhecível, registro como ponto revisável.
- 2FA opcional: código por email ou app autenticador (TOTP) — padrão sólido, mantenho.
- Classificação de dados: tudo tratado como sensível, criptografia em repouso e em trânsito — sensato como default conservador. Marcado como revisável, conforme pedido.
- Compliance: EUA, sem operação de crédito própria no início.

### 2.1 Compliance — o que provavelmente se aplica

Mesmo sem originar crédito, vocês coletam e processam dados financeiros pessoais desde o V1 — isso já aciona obrigações:
- **GLBA (Gramm-Leach-Bliley Act)** — regula privacidade de informação financeira do consumidor nos EUA; provavelmente aplicável mesmo sem originação própria.
- **State privacy laws** (ex: CCPA/CPRA se tiverem usuários da Califórnia, mesmo operando em NY/Miami — a lei segue o dado do residente).
- **FCRA (Fair Credit Reporting Act)** — não deve ser aplicável ainda (vocês não fazem decisão de crédito, só recomendação), mas fica marcado como ponto a revisitar quando o BoB influenciar decisão de terceiro de forma mais direta.

Isso não é algo para eu resolver sozinho no chat — recomendo revisão com advogado especializado em fintech antes do lançamento, mesmo em beta fechado. Deixo marcado como pendência formal, não como resolvido.

### 2.2 Segurança de fronteira

Proposta: Cloudflare na frente de tudo (DNS + WAF + proteção DDoS básica, tier gratuito já ajuda) + a separação de rede privada Railway/Render entre `api` e `bob-engine` já decidida em Arquitetura. Cobre a borda sem introduzir um gateway dedicado antes da hora (fica para quando o B2B for real).

### 2.3 Gestão de segredos — em aberto, como pedido

### 2.4 Modelo de ameaças (proposta inicial, V1)

| Ameaça | Vetor | Mitigação proposta |
|---|---|---|
| Credential stuffing / força bruta no login | Login recorrente | Rate limiting por IP+email, bloqueio progressivo, 2FA disponível |
| Vazamento de dados financeiros em repouso | Breach do banco | Criptografia em repouso (nativa Neon/Postgres), least-privilege de acesso ao DB |
| Interceptação em trânsito | MITM | TLS obrigatório ponta a ponta, HSTS |
| Token do Plaid/Open Finance comprometido | Vazamento de credencial de terceiro | Tokens nunca armazenados em texto puro; escopo mínimo de permissão solicitado ao Plaid |
| Abuso de API por parceiro B2B (futuro) | Uso indevido de API key | Rate limiting + monitoramento de uso por cliente no gateway |
| Exposição de dado sensível em logs/analytics | Log acidental de PII financeira | Redação automática de campos sensíveis antes de qualquer log ou evento de analytics |
| Acesso indevido interno (você mesmo, futuro funcionário) | Insider | Acesso a prod restrito, sem acesso direto a dados de produção fora de necessidade operacional |

---

---

## Nota de revisão — campos obrigatórios em `bob.assessments` (adicionado após review da migration 0000)

A tabela `assessments` precisa, além de `business_id`/`status`/`requested_amount`, dos seguintes campos — sem eles o critério de aceitação da seção 6.1 do plano mestre (auditoria de recomendação) não é atendido:

- `input_snapshot` (jsonb, not null) — cópia do DRE/dados financeiros exatos usados nesta rodada de cálculo
- `sector_segment` (text ou FK para tabela de referência de setores, not null) — qual `ramo` foi usado para aplicar os parâmetros da fórmula (seção 1.2/6.1 do plano)
- `recommended_amount` (numeric(14,2), nullable até status='completed') — capital ótimo calculado
- `score` (numeric ou integer, nullable até completed)
- `confidence_level` (numeric ou enum low/medium/high, nullable até completed) — completude dos dados informados

**Correção obrigatória**: `currency` deve ter default `'USD'`, não `'BRL'` — mercado é EUA (NY/Miami), não Brasil.

**Atualização (reforço de QA da Etapa 5 — teto de plausibilidade)**: `bob.assessments` ganhou a coluna `recommendation_limiter` (enum `dscr` | `revenue_multiple` | `microloan_ceiling`), migração `0005_lethal_ikaris.sql`, aditiva e nullable — aplicada no Postgres de **dev local** nesta sessão. **Não aplicada em nenhum ambiente de produção** (o projeto ainda não tem um). Indica qual dos três limitadores de `recommendedAmount` venceu no cálculo — ver `docs/bob-engine-parametros-setoriais.md` Seção 7 item 7 e `services/bob-engine/src/domain/assessment.ts`.

---

## Envio de email — `apps/api/src/lib/email/` (reforço de QA da Etapa 5)

Os três fluxos que dependem de email (confirmação de cadastro/reenvio, 2FA por login/reenvio, reset de senha) usam a interface `EmailProvider` (`send(message): Promise<void>`), não o SDK de um provedor específico direto nos call-sites de `routes/auth.ts`.

- **Dev/staging**: `EtherealEmailProvider` — conta de teste criada por API (`nodemailer.createTestAccount()`), sem cadastro manual nem token de terceiro configurado. Envio real via SMTP, inspecionável por preview URL (logada em cada `email.sent`) ou via IMAP (usado pelos testes de integração).
- **Produção**: **Resend** (decisão #45), implementado em `ResendEmailProvider` — seleção automática por presença de `RESEND_API_KEY` (sem a chave, cai pra Ethereal). Chave ainda não configurada no `.env` real (`RESEND_API_KEY` fica em standby até a conta ser criada pelo fundador) — código pronto, só falta a credencial.

---

## Pendências e achados abertos (reforço de QA, 2026-07-24)

- **Migrações fora do dev local**: ver `MIGRATIONS_PENDING.md` (raiz do repo) — lista consolidada, nenhuma aplicada fora do Postgres de dev.
- **PII em logs estruturados**: `apps/api` e `bob-engine` logam email em claro e valor exato de `recommendedAmount`/`businessId` via `console.log`, sem redação — só os eventos PostHog (`@artemis-united/analytics`) têm essa proteção (decisão #36). Ver seção 2.4 do plano mestre ("Status real") para o detalhe completo do modelo de ameaças auditado.
- **Rate limiting / HSTS**: nenhum dos dois está implementado (seção 2.4 do plano mestre).
- **DRE wizard**: decisões #27/#34 descrevem 6 blocos com salvamento parcial; implementação real (`DreForm.tsx`) é um formulário único. Ver nota na seção 4.5 do plano mestre.
- Falha de envio nunca bloqueia o fluxo de auth que a disparou (best-effort, vira log estruturado `email.send_failed`) — a conta/código/token já foi persistido antes do envio ser tentado; os endpoints de reenvio existem para dar uma segunda chance.
