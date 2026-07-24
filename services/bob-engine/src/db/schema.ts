import { boolean, integer, jsonb, numeric, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// Nenhuma modelagem formal foi encontrada no repositório para este dominio;
// as tabelas abaixo sao uma primeira aproximacao a partir dos nomes pedidos
// e devem ser revisadas antes de aplicar a migration.
export const bobSchema = pgSchema('bob')

export const assessmentStatus = bobSchema.enum('assessment_status', [
  'draft',
  'in_review',
  'completed',
])

export const institutionOfferStatus = bobSchema.enum('institution_offer_status', [
  'pending',
  'accepted',
  'rejected',
  'expired',
])

export const assessmentOutcomeResult = bobSchema.enum('assessment_outcome_result', [
  'approved',
  'rejected',
  'withdrawn',
])

export const assessmentConfidenceLevel = bobSchema.enum('assessment_confidence_level', [
  'low',
  'medium',
  'high',
])

// Qual limitador venceu no cálculo de recommendedAmount (Fase 4 do reforço
// de QA — teto de plausibilidade). 'dscr' = capacidade via DSCR-alvo
// (Seção 3, comportamento original); 'revenue_multiple' = teto por múltiplo
// de receita mensal (novo, REVENUE_MULTIPLIER_CAP em domain/assessment.ts);
// 'microloan_ceiling' = teto absoluto do SBA Microloan (US$50.000). Dado de
// auditoria da recomendação (critério de aceitação 6.1 do plano mestre).
export const assessmentRecommendationLimiter = bobSchema.enum('assessment_recommendation_limiter', [
  'dscr',
  'revenue_multiple',
  'microloan_ceiling',
])

// Identifica o negocio avaliado por businessId, sem FK para o schema "app"
// (apps/api): bob-engine e isolado e nao deve depender de outro servico.
export const assessments = bobSchema.table('assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull(),
  status: assessmentStatus('status').notNull().default('draft'),
  // Nullable — nenhuma tela ainda pede "quanto você quer pedir" explicitamente;
  // fica null até existir esse input real. Decisão fechada na Etapa 3 (revisando
  // o NOT NULL original), não usar recommendedAmount como placeholder.
  requestedAmount: numeric('requested_amount', { precision: 14, scale: 2 }),
  currency: text('currency').notNull().default('USD'),
  // Copia exata do DRE/dados financeiros usados nesta rodada de calculo (auditoria).
  inputSnapshot: jsonb('input_snapshot').notNull(),
  // Ramo/setor usado para aplicar os parametros da formula nesta rodada.
  sectorSegment: text('sector_segment').notNull(),
  recommendedAmount: numeric('recommended_amount', { precision: 14, scale: 2 }),
  score: numeric('score'),
  confidenceLevel: assessmentConfidenceLevel('confidence_level'),
  // Persistidos no momento do cálculo (fecha o Gap 1 de vez) — GET /latest só lê
  // essas colunas, não recalcula via runAssessment. Se a fórmula mudar no futuro,
  // uma leitura de um assessment antigo continua refletindo o que foi calculado
  // quando ele foi criado, não o resultado da fórmula atual.
  noi: numeric('noi'),
  dscrTarget: numeric('dscr_target'),
  monthlyNewDebtCapacity: numeric('monthly_new_debt_capacity'),
  // Mesma razão das três colunas acima — persistidos no POST, GET /latest só lê,
  // sem recalcular via runAssessment.
  exceedsMicroloanCeiling: boolean('exceeds_microloan_ceiling'),
  marginSanityTriggered: boolean('margin_sanity_triggered'),
  // Nullable pelo mesmo motivo das colunas de cima: linhas criadas antes desta
  // migração (nenhuma em produção — projeto pré-lançamento) ficam null.
  recommendationLimiter: assessmentRecommendationLimiter('recommendation_limiter'),
  sectorFound: boolean('sector_found'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const assessmentRefinements = bobSchema.table('assessment_refinements', {
  id: uuid('id').primaryKey().defaultRandom(),
  assessmentId: uuid('assessment_id')
    .notNull()
    .references(() => assessments.id, { onDelete: 'cascade' }),
  inputData: jsonb('input_data'),
  outputData: jsonb('output_data'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const institutionOffers = bobSchema.table('institution_offers', {
  id: uuid('id').primaryKey().defaultRandom(),
  assessmentId: uuid('assessment_id')
    .notNull()
    .references(() => assessments.id, { onDelete: 'cascade' }),
  institutionName: text('institution_name').notNull(),
  offeredAmount: numeric('offered_amount', { precision: 14, scale: 2 }).notNull(),
  interestRate: numeric('interest_rate', { precision: 6, scale: 3 }).notNull(),
  terms: jsonb('terms'),
  status: institutionOfferStatus('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const assessmentOutcomes = bobSchema.table('assessment_outcomes', {
  id: uuid('id').primaryKey().defaultRandom(),
  assessmentId: uuid('assessment_id')
    .notNull()
    .unique()
    .references(() => assessments.id, { onDelete: 'cascade' }),
  outcome: assessmentOutcomeResult('outcome').notNull(),
  selectedOfferId: uuid('selected_offer_id').references(() => institutionOffers.id),
  // Termos reais do crédito efetivamente tomado pelo usuário — distintos da oferta
  // cotada em institutionOffers (cache, "não fonte de verdade"). Colunas diretas,
  // não jsonb: campo conhecido e estável, ao contrário de institutionOffers.terms
  // (formato varia por instituição externa). Ver docs/bob-engine-parametros-setoriais.md
  // Seção 9, nota técnica.
  effectiveInterestRate: numeric('effective_interest_rate'),
  termMonths: integer('term_months'),
  collateralDescription: text('collateral_description'),
  ownerEquityContributed: numeric('owner_equity_contributed'),
  decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
  notes: text('notes'),
})
