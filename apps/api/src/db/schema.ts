import { boolean, date, integer, numeric, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core'

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

export const maritalStatus = appSchema.enum('marital_status', [
  'single',
  'married',
  'divorced',
  'widowed',
  'separated',
])

// Dados de onboarding-cliente (Etapa 5, seção 4.3) — 1:1 com users. Tabela
// separada em vez de colunas soltas em `users` pelo mesmo motivo de
// `businesses`/`financial_statements`: é um domínio de dado distinto (perfil
// pessoal, não credencial), e Configurações (tarefa 6) faz CRUD só sobre isto.
//
// IMPORTANTE — fronteira da decisão #16 (ECOA) do plano mestre: nenhum campo
// desta tabela pode ser lido, referenciado ou passado para bob-engine em
// nenhuma hipótese. bobEngineClient.ts não importa nem sabe que esta tabela
// existe — não adicionar esse acoplamento no futuro sem reabrir a decisão.
export const customerProfiles = appSchema.table('customer_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  dateOfBirth: date('date_of_birth').notNull(),
  addressLine1: text('address_line1').notNull(),
  addressLine2: text('address_line2'),
  city: text('city').notNull(),
  // Sigla de 2 letras (padrão EUA, ex: "NY", "FL") — validada na camada de
  // aplicação contra a lista oficial de 50 estados + DC, texto livre no schema
  // pelo mesmo motivo de sectorSegment (evita migração se a lista mudar).
  state: text('state').notNull(),
  zipCode: text('zip_code').notNull(),
  maritalStatus: maritalStatus('marital_status').notNull(),
  hasChildren: boolean('has_children').notNull(),
  // Opcional — único campo explicitamente marcado "(opcional)" no pedido.
  householdSize: integer('household_size'),
  alternatePhone: text('alternate_phone').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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
  // Campos da Etapa 5 (seção 4.4) — nullable no schema porque são preenchidos
  // num segundo passo do onboarding (depois da criação com nome+setor da
  // Etapa 4, ver PUT /v1/businesses/me), não na criação em si. Negócios já
  // existentes (dados de teste da Etapa 4) ficam com null até passarem por
  // esse segundo passo — a máquina de estados do front (apps/web) trata
  // addressLine1 null como "onboarding de negócio incompleto".
  addressLine1: text('business_address_line1'),
  addressLine2: text('business_address_line2'),
  city: text('business_city'),
  state: text('business_state'),
  zipCode: text('business_zip_code'),
  yearsInBusiness: integer('years_in_business'),
  yearsOfIndustryExperience: integer('years_of_industry_experience'),
  // Opcional — único campo explicitamente marcado "(opcional)" no pedido.
  phone: text('phone'),
  numberOfEmployees: integer('number_of_employees'),
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
