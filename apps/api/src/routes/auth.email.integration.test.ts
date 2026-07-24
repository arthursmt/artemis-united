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

      // Sequencial de propósito — ver teste .skip abaixo sobre por que dois
      // códigos concorrentes (mesmo usuário) não são suportados hoje.
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

  // PENDENTE — não automatizado ainda. Passos que o teste precisaria cobrir:
  //   1. Device A faz POST /login (agent A, cookie jar próprio) -> recebe
  //      código A por email, NÃO verifica ainda.
  //   2. Device B faz POST /login (agent B, cookie jar separado) enquanto o
  //      código de A ainda está pendente.
  //   3. Esperado pelo roteiro de QA: cada device deveria conseguir
  //      verificar com o PRÓPRIO código, sem um invalidar o outro.
  //
  // GAP DE MODELAGEM ENCONTRADO ESCREVENDO ESTE TESTE (não é bug óbvio,
  // não decidido sozinho): auth/twoFactor.ts permite só UM código pendente
  // por usuário por vez — `createTwoFactorCode` tem cooldown de 60s entre
  // pedidos, e a criação de um novo código APAGA o anterior antes de
  // inserir o novo (ver twoFactor.ts). Ou seja, hoje não existem dois
  // códigos válidos simultâneos pra um mesmo usuário: device B dentro do
  // cooldown recebe 429; device B depois do cooldown invalida
  // silenciosamente o código de A. Pode ser intencional (reduz superfície
  // de tentativa de código por usuário) ou pode ser a causa real de algum
  // relato de "2FA não funciona no segundo dispositivo" — precisa decisão
  // do fundador antes de fechar este teste (ver resumo desta sessão).
  it.skip('dois dispositivos pedindo código de 2FA ao mesmo tempo, cada um com o próprio código — pendente de decisão de produto', () => {})
})
