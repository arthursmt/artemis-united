// Testes de integração dos fluxos que dependem de email real (Fase 3 do
// reforço de QA — confirmação de cadastro e 2FA por login). Batem no app
// Express de verdade (supertest, sem subir porta) + Postgres de dev real +
// envio real via Ethereal (lib/email/) — não fazem mock de nenhuma dessas
// três coisas, de propósito: o objetivo é provar que a mensagem
// efetivamente chega, não só que uma função foi chamada.
//
// Pré-requisito pra rodar: Postgres local de pé (docker compose, ver
// .claude/skills/run-dev) e as variáveis de infra/.env carregadas no
// processo (`set -a && source .env && set +a` antes de `npm test`, mesma
// exigência de `npm run dev`).
import { afterEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { eq } from 'drizzle-orm'
import { createApp } from '../app.js'
import { db } from '../db/client.js'
import { emailVerificationTokens, twoFactorCodes, users } from '../db/schema.js'
import { fetchLatestEmailTo } from '../test/etherealInbox.js'

const app = createApp()
const PASSWORD = 'Test1234!'
const EMAIL_TEST_TIMEOUT_MS = 20_000

function uniqueEmail(label: string): string {
  return `qa.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`
}

function extractVerificationToken(emailText: string): string {
  const match = emailText.match(/\?verify=([\w-]+)/)
  if (!match) {
    throw new Error(`link de verificação não encontrado no corpo do email: ${emailText}`)
  }
  return match[1]
}

function extractTwoFactorCode(emailText: string): string {
  const match = emailText.match(/(\d{6})/)
  if (!match) {
    throw new Error(`código de 2FA não encontrado no corpo do email: ${emailText}`)
  }
  return match[1]
}

async function signupAndVerify(email: string): Promise<void> {
  await request(app)
    .post('/v1/auth/signup')
    .send({ email, password: PASSWORD, confirmPassword: PASSWORD, acceptedTerms: true })
    .expect(201)

  const inbox = await fetchLatestEmailTo(email)
  const token = extractVerificationToken(inbox.text)

  await request(app).post('/v1/auth/verify-email').send({ token }).expect(200)
}

// Limpeza de dado de teste do Postgres depois de cada teste (convenção do
// projeto para testes manuais, aplicada aqui também) — cascade cuida de
// email_verification_tokens/two_factor_codes/sessions via FK.
const createdEmails: string[] = []
afterEach(async () => {
  for (const email of createdEmails.splice(0)) {
    await db.delete(users).where(eq(users.email, email))
  }
})

describe('confirmação de cadastro por email', () => {
  it(
    'envia o email de verdade e o link de verificação confirma a conta',
    async () => {
      const email = uniqueEmail('verify')
      createdEmails.push(email)

      await signupAndVerify(email)

      const login = await request(app).post('/v1/auth/login').send({ email, password: PASSWORD })
      expect(login.status).toBe(200)
      expect(login.body.user.email).toBe(email)
    },
    EMAIL_TEST_TIMEOUT_MS,
  )

  it(
    'bloqueia reenvio antes do cooldown de 24h e libera depois de 24h',
    async () => {
      const email = uniqueEmail('cooldown')
      createdEmails.push(email)

      await request(app)
        .post('/v1/auth/signup')
        .send({ email, password: PASSWORD, confirmPassword: PASSWORD, acceptedTerms: true })
        .expect(201)

      const blocked = await request(app).post('/v1/auth/resend-verification').send({ email })
      expect(blocked.status).toBe(429)
      expect(blocked.body.retryAfterSeconds).toBeGreaterThan(0)

      const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
      await db
        .update(emailVerificationTokens)
        .set({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
        .where(eq(emailVerificationTokens.userId, user.id))

      const allowed = await request(app).post('/v1/auth/resend-verification').send({ email })
      expect(allowed.status).toBe(200)
    },
    EMAIL_TEST_TIMEOUT_MS,
  )
})

describe('2FA por email', () => {
  async function setupTwoFactorUser(label: string): Promise<string> {
    const email = uniqueEmail(label)
    createdEmails.push(email)
    await signupAndVerify(email)

    const agent = request.agent(app)
    await agent.post('/v1/auth/login').send({ email, password: PASSWORD }).expect(200)
    await agent.post('/v1/auth/two-factor/toggle').send({ enabled: true }).expect(200)

    return email
  }

  it(
    'código certo por email completa o login',
    async () => {
      const email = await setupTwoFactorUser('2fa-ok')

      const login = await request(app).post('/v1/auth/login').send({ email, password: PASSWORD })
      expect(login.status).toBe(200)
      expect(login.body.twoFactorRequired).toBe(true)
      const userId = login.body.userId as string

      const inbox = await fetchLatestEmailTo(email)
      const code = extractTwoFactorCode(inbox.text)

      const right = await request(app).post('/v1/auth/verify-2fa').send({ userId, code })
      expect(right.status).toBe(200)
      expect(right.body.user.email).toBe(email)
    },
    EMAIL_TEST_TIMEOUT_MS,
  )

  it(
    'código errado é rejeitado — e consome a tentativa (uso único por tentativa, não por acerto)',
    async () => {
      const email = await setupTwoFactorUser('2fa-wrong')

      const login = await request(app).post('/v1/auth/login').send({ email, password: PASSWORD })
      const userId = login.body.userId as string

      const inbox = await fetchLatestEmailTo(email)
      const code = extractTwoFactorCode(inbox.text)

      const wrong = await request(app).post('/v1/auth/verify-2fa').send({ userId, code: '000000' })
      expect(wrong.status).toBe(400)

      // consumeTwoFactorCode (auth/twoFactor.ts) apaga o código pendente na
      // primeira tentativa, certa ou errada — uso único por TENTATIVA, não
      // por acerto (mitiga força bruta: não dá pra ficar tentando o mesmo
      // código várias vezes). Por isso o código certo, usado logo em
      // seguida, também é rejeitado — comportamento esperado, não um bug.
      const afterWrong = await request(app).post('/v1/auth/verify-2fa').send({ userId, code })
      expect(afterWrong.status).toBe(400)
    },
    EMAIL_TEST_TIMEOUT_MS,
  )

  it(
    'código expirado é rejeitado mesmo estando correto',
    async () => {
      const email = await setupTwoFactorUser('2fa-expired')

      const login = await request(app).post('/v1/auth/login').send({ email, password: PASSWORD })
      const userId = login.body.userId as string

      const inbox = await fetchLatestEmailTo(email)
      const code = extractTwoFactorCode(inbox.text)

      await db
        .update(twoFactorCodes)
        .set({ expiresAt: new Date(Date.now() - 1_000) })
        .where(eq(twoFactorCodes.userId, userId))

      const res = await request(app).post('/v1/auth/verify-2fa').send({ userId, code })
      expect(res.status).toBe(400)
    },
    EMAIL_TEST_TIMEOUT_MS,
  )

  it(
    'uma segunda sessão completada não invalida nem herda a sessão já existente',
    async () => {
      const email = await setupTwoFactorUser('2fa-multisession')

      async function completeLogin(): Promise<string> {
        const login = await request(app).post('/v1/auth/login').send({ email, password: PASSWORD })
        const userId = login.body.userId as string
        const inbox = await fetchLatestEmailTo(email)
        const code = extractTwoFactorCode(inbox.text)
        const verify = await request(app).post('/v1/auth/verify-2fa').send({ userId, code }).expect(200)
        const cookie = verify.headers['set-cookie']?.[0]
        if (!cookie) {
          throw new Error('resposta de verify-2fa não trouxe cookie de sessão')
        }
        return cookie
      }

      // Sequencial de propósito — ver testes abaixo sobre por que dois
      // códigos concorrentes (mesmo usuário) não são suportados por desenho
      // (decisão confirmada: um código por usuário, não por dispositivo).
      const cookieA = await completeLogin()
      const cookieB = await completeLogin()

      expect(cookieA).not.toEqual(cookieB)

      const meA = await request(app).get('/v1/auth/me').set('Cookie', cookieA)
      const meB = await request(app).get('/v1/auth/me').set('Cookie', cookieB)
      expect(meA.status).toBe(200)
      expect(meB.status).toBe(200)
    },
    EMAIL_TEST_TIMEOUT_MS * 2,
  )

  // DECISÃO CONFIRMADA PELO FUNDADOR (ver Log de decisões do plano mestre):
  // código de 2FA é por USUÁRIO, não por dispositivo/sessão — reduz
  // superfície de tentativa de código. auth/twoFactor.ts implementa isso via
  // `createTwoFactorCode`: só um código pendente por vez, cooldown de 60s
  // entre pedidos, e um novo pedido (depois do cooldown) apaga o anterior
  // antes de criar o novo.
  it(
    'segundo dispositivo pedindo código dentro do cooldown recebe 429 — um código por usuário, não por dispositivo',
    async () => {
      const email = await setupTwoFactorUser('2fa-one-per-user')

      const deviceA = await request(app).post('/v1/auth/login').send({ email, password: PASSWORD })
      expect(deviceA.status).toBe(200)
      expect(deviceA.body.twoFactorRequired).toBe(true)
      const codeAInbox = await fetchLatestEmailTo(email)
      const codeA = extractTwoFactorCode(codeAInbox.text)

      // Device B tenta logar em seguida, ainda dentro do cooldown de 60s —
      // não recebe um código independente, recebe 429.
      const deviceB = await request(app).post('/v1/auth/login').send({ email, password: PASSWORD })
      expect(deviceB.status).toBe(429)
      expect(deviceB.body.retryAfterSeconds).toBeGreaterThan(0)

      // Código de A continua válido normalmente — B não o afetou.
      const userId = deviceA.body.userId as string
      const verifyA = await request(app).post('/v1/auth/verify-2fa').send({ userId, code: codeA })
      expect(verifyA.status).toBe(200)
    },
    EMAIL_TEST_TIMEOUT_MS * 2,
  )

  it(
    'depois do cooldown, um novo pedido de código substitui o anterior — código antigo para de funcionar',
    async () => {
      const email = await setupTwoFactorUser('2fa-replace-after-cooldown')

      const deviceA = await request(app).post('/v1/auth/login').send({ email, password: PASSWORD })
      const userId = deviceA.body.userId as string
      const codeAInbox = await fetchLatestEmailTo(email)
      const codeA = extractTwoFactorCode(codeAInbox.text)

      // Simula cooldown de 60s decorrido (mesma técnica do teste de cooldown
      // de 24h acima — evita esperar tempo real dentro do teste).
      await db
        .update(twoFactorCodes)
        .set({ createdAt: new Date(Date.now() - 61_000) })
        .where(eq(twoFactorCodes.userId, userId))

      const deviceB = await request(app).post('/v1/auth/login').send({ email, password: PASSWORD })
      expect(deviceB.status).toBe(200)
      expect(deviceB.body.twoFactorRequired).toBe(true)
      const codeBInbox = await fetchLatestEmailTo(email)
      const codeB = extractTwoFactorCode(codeBInbox.text)
      expect(codeB).not.toBe(codeA)

      // Código de A (device A) foi silenciosamente substituído — deixa de
      // funcionar, mesmo nunca tendo sido usado. Uma única tentativa de
      // verify já consome a linha pendente (mesmo comportamento "uso único
      // por TENTATIVA" do teste de código errado acima) — por isso este
      // teste só faz UMA chamada a /verify-2fa: tentar o código antigo
      // primeiro já queimaria a linha que pertence ao código novo, então
      // "antigo rejeitado" e "novo funciona" não são verificáveis na mesma
      // chamada em sequência, teriam que ser dois setups independentes.
      const verifyOldCode = await request(app).post('/v1/auth/verify-2fa').send({ userId, code: codeA })
      expect(verifyOldCode.status).toBe(400)
    },
    EMAIL_TEST_TIMEOUT_MS * 2,
  )
})
