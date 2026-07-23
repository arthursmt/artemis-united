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
  // Nullable de propósito (não NOT NULL): linhas de antes desta coluna existir
  // (dados de teste da Etapa 4) não têm valor real aqui, e adicionar NOT NULL
  // nesta migração exigiria um default silencioso que mascararia a ausência real
  // de aceite. A rota de signup sempre grava um valor real ao criar a conta;
  // null = aceite nunca registrado, tratado como "não aceitou" por qualquer
  // lógica futura que precise checar isso.
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
  // Nullable = conta ainda não confirmou o email. Ver auth/emailVerification.ts.
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Token de confirmação de email — mesmo padrão de `sessions`: token aleatório
// entregue ao usuário (via link no email, stub por enquanto — ver
// lib/emailStub.ts), só o hash SHA-256 fica no banco. Uso único: consumido e
// apagado na confirmação.
export const emailVerificationTokens = appSchema.table('email_verification_tokens', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Mesmo padrão de email_verification_tokens — tabela separada porque o ciclo de
// vida é diferente: reset pode ser solicitado várias vezes, e cada solicitação
// nova invalida qualquer token anterior do mesmo usuário (ver
// auth/passwordReset.ts) — não faz sentido reaproveitar a tabela de verificação
// de email pra isso.
export const passwordResetTokens = appSchema.table('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const businesses = appSchema.table('businesses', {
  id: uuid('id').primaryKey().defaultRandom(),
  // UNIQUE fecha a corrida de duas criações simultâneas no nível do banco — a checagem
  // 409 na rota (apps/api/src/routes/businesses.ts) continua sendo a validação
  // primária, isto é o cinto de segurança. Nota: isso trava 1:N por usuário também no
  // schema, não só na aplicação — suportar múltiplos negócios por usuário no futuro
  // exigiria uma migração pra derrubar esta constraint.
  ownerUserId: uuid('owner_user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Texto livre, não enum — mesmo padrão de bob.assessments.sector_segment. Validação
  // contra os 14 slugs (+ "outro") fica na camada de aplicação, via
  // @artemis-united/shared-types (services/bob-engine/src/domain/sectors.ts importa de lá
  // também, fonte única).
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
