// Testes de integração do fluxo de onboarding (perfil do cliente + negócio)
// e do DRE (financial-statements) — Fase 1 do reforço de QA, critério de
// aceitação 6.3 (fluxo crítico com teste automatizado cobrindo caminho
// feliz + casos de borda). Bate no app Express real (supertest) + Postgres
// de dev real + Ethereal (confirmação de cadastro) + bob-engine real
// rodando em localhost:4100 (necessário pro teste de DRE completar o ciclo
// até a recomendação) — nenhum mock.
//
// Pré-requisito pra rodar: Postgres E bob-engine de pé (ver
// .claude/skills/run-dev), variáveis de infra/.env carregadas.
//
// NÃO cobre a regressão original do bug do PR #8 (onboarding-negócio
// travado num 409 NA TELA) — aquele fix foi inteiramente client-side
// (apps/web/src/App.tsx, BusinessOnboardingForm.tsx), e apps/web não tem
// nenhuma infraestrutura de teste ainda (nem vitest, nem testing-library).
// O teste "regressão do PR #8" abaixo cobre o CONTRATO de API que o bug
// reagia a (POST /businesses sempre 409 em duplicata, nunca sobrescreve) —
// é a metade testável sem construir infraestrutura de teste de componente
// React nova, que não estava no escopo desta sessão sem alinhamento antes.
import { afterEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { eq } from 'drizzle-orm'
import { createApp } from '../app.js'
import { db } from '../db/client.js'
import { financialStatements, users } from '../db/schema.js'
import { fetchLatestEmailTo } from '../test/etherealInbox.js'

const app = createApp()
const PASSWORD = 'Test1234!'
const EMAIL_TEST_TIMEOUT_MS = 20_000

function uniqueEmail(label: string): string {
  return `qa.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`
}

// request.agent mantém cookies entre chamadas — usado aqui pra simular um
// único usuário autenticado passando pelas etapas sequenciais do onboarding.
async function createVerifiedSession(label: string): Promise<{ email: string; agent: ReturnType<typeof request.agent> }> {
  const email = uniqueEmail(label)
  const agent = request.agent(app)

  await agent
    .post('/v1/auth/signup')
    .send({ email, password: PASSWORD, confirmPassword: PASSWORD, acceptedTerms: true })
    .expect(201)

  const inbox = await fetchLatestEmailTo(email)
  const match = inbox.text.match(/\?verify=([\w-]+)/)
  if (!match) {
    throw new Error(`link de verificação não encontrado no corpo do email: ${inbox.text}`)
  }
  await agent.post('/v1/auth/verify-email').send({ token: match[1] }).expect(200)

  return { email, agent }
}

const createdEmails: string[] = []
afterEach(async () => {
  for (const email of createdEmails.splice(0)) {
    await db.delete(users).where(eq(users.email, email))
  }
})

describe('onboarding — perfil do cliente e negócio', () => {
  it(
    'caminho feliz: cria perfil do cliente, cria negócio, atualiza detalhes do negócio',
    async () => {
      const { email, agent } = await createVerifiedSession('onboarding-happy')
      createdEmails.push(email)

      const profile = await agent.post('/v1/customer-profile').send({
        dateOfBirth: '1990-05-15',
        addressLine1: '123 Main St',
        addressLine2: null,
        city: 'Miami',
        state: 'FL',
        zipCode: '33101',
        maritalStatus: 'single',
        hasChildren: false,
        householdSize: null,
        alternatePhone: '3055551234',
      })
      expect(profile.status).toBe(201)

      const business = await agent
        .post('/v1/businesses')
        .send({ name: 'QA Test Diner', sectorSegment: 'restaurante_full_service' })
      expect(business.status).toBe(201)

      const details = await agent.put('/v1/businesses/me').send({
        addressLine1: '123 Main St',
        addressLine2: null,
        city: 'Miami',
        state: 'FL',
        zipCode: '33101',
        yearsInBusiness: 3,
        yearsOfIndustryExperience: 5,
        phone: null,
        numberOfEmployees: 4,
      })
      expect(details.status).toBe(200)
      expect(details.body.business.addressLine1).toBe('123 Main St')
      expect(details.body.business.numberOfEmployees).toBe(4)
    },
    EMAIL_TEST_TIMEOUT_MS,
  )

  it(
    'regressão do PR #8: criar negócio duas vezes sempre retorna 409, nunca sobrescreve o já existente',
    async () => {
      const { email, agent } = await createVerifiedSession('onboarding-409')
      createdEmails.push(email)

      const first = await agent.post('/v1/businesses').send({ name: 'Original Name', sectorSegment: 'padaria' })
      expect(first.status).toBe(201)

      const second = await agent
        .post('/v1/businesses')
        .send({ name: 'Attempted Overwrite', sectorSegment: 'limpeza' })
      expect(second.status).toBe(409)

      const stillOriginal = await agent.get('/v1/businesses/me')
      expect(stillOriginal.status).toBe(200)
      expect(stillOriginal.body.business.name).toBe('Original Name')
      expect(stillOriginal.body.business.sectorSegment).toBe('padaria')
    },
    EMAIL_TEST_TIMEOUT_MS,
  )
})

describe('DRE — financial-statements', () => {
  async function createVerifiedSessionWithBusiness(
    label: string,
    sectorSegment: string,
  ): Promise<{ email: string; agent: ReturnType<typeof request.agent> }> {
    const { email, agent } = await createVerifiedSession(label)
    await agent.post('/v1/businesses').send({ name: 'QA DRE Business', sectorSegment }).expect(201)
    return { email, agent }
  }

  it(
    'caminho feliz: submete DRE e recebe recomendação de crédito do bob-engine',
    async () => {
      const { email, agent } = await createVerifiedSessionWithBusiness('dre-happy', 'restaurante_full_service')
      createdEmails.push(email)

      const res = await agent.post('/v1/financial-statements').send({
        revenue: 6000,
        directCosts: 2000,
        operatingExpenses: 1500,
        currentDebtService: 200,
        personalExtraIncome: 0,
        personalExpenses: 1500,
      })

      expect(res.status).toBe(201)
      expect(res.body.recommendedAmount).toBeDefined()
      // Mesmo cenário do bug original do teto de plausibilidade (PR #13,
      // sessão anterior) — confirma que a chamada apps/api -> bob-engine
      // preserva o campo recommendationLimiter de ponta a ponta.
      expect(res.body.recommendationLimiter).toBe('revenue_multiple')
    },
    EMAIL_TEST_TIMEOUT_MS,
  )

  it(
    'nunca sobrescreve: duas submissões pro mesmo negócio geram duas linhas versionadas, não uma atualizada',
    async () => {
      const { email, agent } = await createVerifiedSessionWithBusiness('dre-versioned', 'padaria')
      createdEmails.push(email)

      const business = await agent.get('/v1/businesses/me')
      const businessId = business.body.business.id as string

      await agent
        .post('/v1/financial-statements')
        .send({
          revenue: 8000,
          directCosts: 3000,
          operatingExpenses: 2000,
          currentDebtService: 300,
          personalExtraIncome: 0,
          personalExpenses: 1000,
        })
        .expect(201)

      await agent
        .post('/v1/financial-statements')
        .send({
          revenue: 9000,
          directCosts: 3500,
          operatingExpenses: 2200,
          currentDebtService: 300,
          personalExtraIncome: 0,
          personalExpenses: 1000,
        })
        .expect(201)

      const rows = await db.select().from(financialStatements).where(eq(financialStatements.businessId, businessId))
      expect(rows.length).toBe(2)
      expect(new Set(rows.map((row) => row.revenue)).size).toBe(2) // duas linhas distintas, não uma sobrescrita
    },
    EMAIL_TEST_TIMEOUT_MS,
  )
})
