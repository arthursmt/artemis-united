# Migrações pendentes de aplicação fora do dev local

> Gerado na Fase 3 do reforço de QA (2026-07-24). Objetivo: um único lugar
> pra saber o que precisa rodar quando um ambiente real (staging/prod) for
> provisionado — hoje **não existe nenhum ambiente real**, só Postgres
> local via `infra/docker-compose.yml`. Todas as migrações abaixo foram
> aplicadas **apenas em dev local**.
>
> Não aplique nada daqui contra um ambiente que não seja dev local sem
> confirmação explícita — se este arquivo estiver desatualizado (um
> ambiente real já existe), pare e confirme antes de mexer.

## Como aplicar (quando houver ambiente real)

Cada pacote tem seu próprio `drizzle.config.ts` e cadeia de migração —
rodar `npx drizzle-kit migrate` **de dentro do pacote** (`apps/api` ou
`services/bob-engine`), com `DATABASE_URL` apontando pro ambiente alvo:

```bash
# dentro de apps/api ou services/bob-engine
DATABASE_URL=<url-do-ambiente-alvo> npx drizzle-kit migrate
```

O script de role manual do Metabase (não gerenciado por `drizzle-kit`, ver
seção própria abaixo) precisa ser rodado à parte, via `psql`, contra o
mesmo banco.

## `apps/api` (schema `app`) — 9 migrações

| # | Arquivo | O que faz |
|---|---|---|
| 0000 | `0000_unique_epoch.sql` | Cria schema `app` e as tabelas iniciais (users, sessions, businesses, financial_statements, institution_connections) |
| 0001 | `0001_calm_captain_universe.sql` | Torna `legal_name`/`tax_id`/`period_start`/`period_end` nullable |
| 0002 | `0002_sad_timeslip.sql` | Remove colunas `legal_name`, `period_start`, `period_end` |
| 0003 | `0003_graceful_bromley.sql` | Constraint UNIQUE em `businesses.owner_user_id` (trava 1 negócio por usuário) |
| 0004 | `0004_secret_cargill.sql` | Cria `email_verification_tokens` |
| 0005 | `0005_striped_roxanne_simpson.sql` | Cria `password_reset_tokens` |
| 0006 | `0006_cuddly_mole_man.sql` | Cria enum `marital_status` e tabela `customer_profiles` |
| 0007 | `0007_young_zarek.sql` | Adiciona colunas de endereço/detalhes a `businesses` (Etapa 5, seção 4.4) |
| 0008 | `0008_wet_tiger_shark.sql` | Cria `two_factor_codes` (Etapa 5, 2FA por email) |

## `services/bob-engine` (schema `bob`) — 6 migrações + 1 script manual

| # | Arquivo | O que faz |
|---|---|---|
| 0000 | `0000_lucky_saracen.sql` | Cria schema `bob` e as tabelas iniciais (assessments, assessment_refinements, institution_offers, assessment_outcomes) |
| 0001 | `0001_abnormal_lenny_balinger.sql` | Adiciona campos de outcome real (`effective_interest_rate`, `term_months`, `collateral_description`, etc.) a `assessment_outcomes` |
| 0002 | `0002_sticky_masked_marvel.sql` | `assessments.requested_amount` vira nullable |
| 0003 | `0003_living_boomerang.sql` | Adiciona `noi`, `dscr_target`, `monthly_new_debt_capacity` a `assessments` (fecha Gap 1 de auditoria) |
| 0004 | `0004_brave_triton.sql` | Adiciona `exceeds_microloan_ceiling`, `margin_sanity_triggered`, `sector_found` a `assessments` |
| 0005 | `0005_lethal_ikaris.sql` | Adiciona enum + coluna `recommendation_limiter` a `assessments` (teto de plausibilidade, PR #13) |
| manual/0001 | `manual/0001_metabase_readonly_role.sql` | Cria role `metabase_readonly`, GRANT restrito ao schema `bob` (decisão #37) — **não roda via `drizzle-kit`**, script manual, ver comentário no próprio arquivo |

## Nota

Este arquivo deve ser atualizado toda vez que uma nova migração for gerada
(`drizzle-kit generate`) em qualquer um dos dois pacotes, e uma linha deve
ser removida (ou marcada como aplicada) quando um ambiente real receber a
migração correspondente.
