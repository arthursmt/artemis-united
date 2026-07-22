import { numeric, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// Nenhuma modelagem formal foi encontrada no repositório para este dominio;
// as tabelas abaixo sao uma primeira aproximacao a partir dos nomes pedidos
// e devem ser revisadas antes de aplicar a migration.
export const appSchema = pgSchema('app')

export const institutionConnectionStatus = appSchema.enum('institution_connection_status', [
  'pending',
  'active',
  'revoked',
])

export const users = appSchema.table('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const businesses = appSchema.table('businesses', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Texto livre, não enum — mesmo padrão de bob.assessments.sector_segment. Validação
  // contra os 14 slugs (+ "outro") fica na camada de aplicação, via
  // @artemis-united/shared-types (services/bob-engine/src/domain/sectors.ts importa de lá
  // também, fonte única). Sem UNIQUE em ownerUserId de propósito: a trava de 1
  // negócio/usuário do V1 é regra de negócio na rota, não do schema (schema já permite
  // 1:N para o futuro).
  sectorSegment: text('sector_segment').notNull(),
  // Nullable — Etapa 4 não coleta CNPJ/EIN no formulário de criação de negócio.
  taxId: text('tax_id').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Snapshot mensal versionado do DRE mínimo (nunca sobrescrever — cada submissão gera
// uma linha nova). Colunas mapeiam 1:1 para MonthlyFinancials
// (services/bob-engine/src/domain/assessment.ts) — mesmo formato enviado ao bob-engine.
export const financialStatements = appSchema.table('financial_statements', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  revenue: numeric('revenue', { precision: 14, scale: 2 }).notNull(),
  directCosts: numeric('direct_costs', { precision: 14, scale: 2 }).notNull(),
  operatingExpenses: numeric('operating_expenses', { precision: 14, scale: 2 }).notNull(),
  currentDebtService: numeric('current_debt_service', { precision: 14, scale: 2 }).notNull(),
  personalExtraIncome: numeric('personal_extra_income', { precision: 14, scale: 2 }).notNull(),
  personalExpenses: numeric('personal_expenses', { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const institutionConnections = appSchema.table('institution_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  institutionName: text('institution_name').notNull(),
  status: institutionConnectionStatus('status').notNull().default('pending'),
  externalReference: text('external_reference'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Sessao no padrao recomendado pela propria documentacao da Lucia para
// substituir a lib (deprecada): so o hash SHA-256 do token fica no banco.
export const sessions = appSchema.table('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})
