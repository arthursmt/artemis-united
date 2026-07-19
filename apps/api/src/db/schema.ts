import { date, jsonb, numeric, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core'

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
  legalName: text('legal_name').notNull(),
  taxId: text('tax_id').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const financialStatements = appSchema.table('financial_statements', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  revenue: numeric('revenue', { precision: 14, scale: 2 }).notNull(),
  expenses: numeric('expenses', { precision: 14, scale: 2 }).notNull(),
  rawData: jsonb('raw_data'),
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
