// Teste de integração HTTP do rate limiting de login (Fase 3 do reforço de
// QA, plano mestre §2.4) — bate no app Express de verdade (supertest) +
// Postgres de dev real. Não usa email real (diferente de
// auth.email.integration.test.ts): a conta é verificada direto no banco pra
// manter o teste rápido, já que o que está sob teste aqui é o bloqueio de
// login, não o fluxo de confirmação por email.
import { afterEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { eq } from 'drizzle-orm'
import { createApp } from '../app.js'
import { db } from '../db/client.js'
import { loginAttempts, users } from '../db/schema.js'

const app = createApp()
const PASSWORD = 'Test1234!'
const WRONG_PASSWORD = 'SenhaErrada1!'

function uniqueEmail(label: string): string {
  return `qa.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`
}

async function createVerifiedUser(email: string): Promise<void> {
  await request(app)
    .post('/v1/auth/signup')
    .send({ email, password: PASSWORD, confirmPassword: PASSWORD, acceptedTerms: true })
    .expect(201)
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.email, email))
}

// attempt_key é sha256(ip+email) — não dá pra filtrar a linha certa por uma
// coluna direta (ver auth/loginRateLimit.ts). Como cada teste usa um email
// globalmente único, a linha que aparece entre "antes" e "depois" da
// primeira tentativa errada É a linha deste teste, mesmo com outros arquivos
// de teste rodando em paralelo contra a mesma tabela.
async function captureAttemptKey(action: () => Promise<unknown>): Promise<string> {
  const before = new Set((await db.select({ key: loginAttempts.attemptKey }).from(loginAttempts)).map((r) => r.key))
  await action()
  const after = await db.select({ key: loginAttempts.attemptKey }).from(loginAttempts)
  const created = after.find((row) => !before.has(row.key))
  if (!created) {
    throw new Error('nenhuma linha nova em login_attempts depois da ação')
  }
  return created.key
}

interface CleanupEntry {
  email: string
  attemptKey?: string
}

const cleanup: CleanupEntry[] = []
afterEach(async () => {
  for (const { email, attemptKey } of cleanup.splice(0)) {
    await db.delete(users).where(eq(users.email, email))
    if (attemptKey) {
      await db.delete(loginAttempts).where(eq(loginAttempts.attemptKey, attemptKey))
    }
  }
})

describe('rate limiting de login (IP+email combinado, bloqueio progressivo)', () => {
  it('sequência de senhas erradas dispara o bloqueio (429) depois do limite', async () => {
    const email = uniqueEmail('lockout-trigger')
    const entry: CleanupEntry = { email }
    cleanup.push(entry)
    await createVerifiedUser(email)

    entry.attemptKey = await captureAttemptKey(() =>
      request(app).post('/v1/auth/login').send({ email, password: WRONG_PASSWORD }).expect(401),
    )
    for (let i = 0; i < 4; i++) {
      await request(app).post('/v1/auth/login').send({ email, password: WRONG_PASSWORD }).expect(401)
    }

    const res = await request(app).post('/v1/auth/login').send({ email, password: WRONG_PASSWORD })
    expect(res.status).toBe(429)
    expect(res.body.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('bloqueio ativo barra até a senha CERTA, não só as erradas', async () => {
    const email = uniqueEmail('lockout-blocks-correct')
    const entry: CleanupEntry = { email }
    cleanup.push(entry)
    await createVerifiedUser(email)

    entry.attemptKey = await captureAttemptKey(() =>
      request(app).post('/v1/auth/login').send({ email, password: WRONG_PASSWORD }).expect(401),
    )
    for (let i = 0; i < 5; i++) {
      await request(app).post('/v1/auth/login').send({ email, password: WRONG_PASSWORD })
    }

    const res = await request(app).post('/v1/auth/login').send({ email, password: PASSWORD })
    expect(res.status).toBe(429)
  })

  it('login correto depois do bloqueio expirar funciona normalmente', async () => {
    const email = uniqueEmail('lockout-expires')
    const entry: CleanupEntry = { email }
    cleanup.push(entry)
    await createVerifiedUser(email)

    entry.attemptKey = await captureAttemptKey(() =>
      request(app).post('/v1/auth/login').send({ email, password: WRONG_PASSWORD }).expect(401),
    )
    for (let i = 0; i < 5; i++) {
      await request(app).post('/v1/auth/login').send({ email, password: WRONG_PASSWORD })
    }

    const stillLocked = await request(app).post('/v1/auth/login').send({ email, password: PASSWORD })
    expect(stillLocked.status).toBe(429)

    // Simula o bloqueio já ter expirado (mesmo padrão de token expirado usado
    // em auth.email.integration.test.ts) em vez de esperar o tempo real
    // passar.
    await db
      .update(loginAttempts)
      .set({ lockedUntil: new Date(Date.now() - 1_000) })
      .where(eq(loginAttempts.attemptKey, entry.attemptKey))

    const res = await request(app).post('/v1/auth/login').send({ email, password: PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(email)
  })

  it('login bem-sucedido limpa o histórico de falhas anteriores', async () => {
    const email = uniqueEmail('lockout-clears-on-success')
    const entry: CleanupEntry = { email }
    cleanup.push(entry)
    await createVerifiedUser(email)

    entry.attemptKey = await captureAttemptKey(() =>
      request(app).post('/v1/auth/login').send({ email, password: WRONG_PASSWORD }).expect(401),
    )
    await request(app).post('/v1/auth/login').send({ email, password: PASSWORD }).expect(200)

    const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.attemptKey, entry.attemptKey))
    expect(row).toBeUndefined()
  })
})
