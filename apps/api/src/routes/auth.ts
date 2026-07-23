import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import { clearSessionCookie, setSessionCookie } from '../auth/cookies.js'
import {
  consumeEmailVerificationToken,
  createEmailVerificationToken,
  generateVerificationToken,
} from '../auth/emailVerification.js'
import { requireAuth } from '../auth/middleware.js'
import { hashPassword, isPasswordValid, verifyPassword } from '../auth/password.js'
import {
  createSession,
  generateSessionToken,
  invalidateSession,
  SESSION_COOKIE_NAME,
  validateSessionToken,
} from '../auth/session.js'
import { sendStubEmail } from '../lib/emailStub.js'

export const authRouter = Router()

function webAppUrl(): string {
  return process.env.WEB_APP_URL ?? 'http://localhost:5173'
}

interface Credentials {
  email?: unknown
  password?: unknown
}

function parseCredentials(body: unknown): { email: string; password: string } | null {
  const { email, password } = (body ?? {}) as Credentials
  if (typeof email !== 'string' || typeof password !== 'string' || email.trim() === '') {
    return null
  }
  return { email: email.trim().toLowerCase(), password }
}

interface SignupBody extends Credentials {
  acceptedTerms?: unknown
}

authRouter.post('/signup', async (req, res) => {
  const credentials = parseCredentials(req.body)
  if (!credentials) {
    res.status(400).json({ error: 'email and password are required' })
    return
  }

  // Aceite de Termos de Uso/Privacidade obrigatório pra submeter — checagem no
  // servidor, não só no checkbox do cliente (o front não deixa submeter sem
  // marcar, mas a API não confia só nisso).
  if ((req.body as SignupBody)?.acceptedTerms !== true) {
    res.status(400).json({ error: 'you must accept the Terms of Use and Privacy Policy' })
    return
  }

  if (!isPasswordValid(credentials.password)) {
    res.status(400).json({
      error:
        'password must be at least 8 characters and include an uppercase letter, a lowercase letter, a digit, and a special character',
    })
    return
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, credentials.email))
  if (existing.length > 0) {
    res.status(409).json({ error: 'email already registered' })
    return
  }

  const passwordHash = await hashPassword(credentials.password)
  const [user] = await db
    .insert(users)
    .values({
      email: credentials.email,
      passwordHash,
      termsAcceptedAt: new Date(),
    })
    .returning({ id: users.id, email: users.email })

  // Sem sessão ainda — acesso completo só é liberado depois da confirmação de
  // email (POST /verify-email). Decisão fechada da tarefa: "verificação de
  // email antes de liberar acesso completo".
  const verificationToken = generateVerificationToken()
  await createEmailVerificationToken(verificationToken, user.id)
  sendStubEmail(user.email, 'Confirme seu email — Artemis United', {
    verificationUrl: `${webAppUrl()}/?verify=${verificationToken}`,
  })

  res.status(201).json({ user, verificationRequired: true })
})

authRouter.post('/verify-email', async (req, res) => {
  const token = (req.body as { token?: unknown })?.token
  if (typeof token !== 'string' || token === '') {
    res.status(400).json({ error: 'token is required' })
    return
  }

  const userId = await consumeEmailVerificationToken(token)
  if (!userId) {
    res.status(400).json({ error: 'invalid or expired token' })
    return
  }

  const [user] = await db
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ id: users.id, email: users.email })

  const sessionToken = generateSessionToken()
  const session = await createSession(sessionToken, user.id)
  setSessionCookie(res, sessionToken, session.expiresAt)

  res.status(200).json({ user })
})

authRouter.post('/login', async (req, res) => {
  const credentials = parseCredentials(req.body)
  if (!credentials) {
    res.status(400).json({ error: 'email and password are required' })
    return
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(users)
    .where(eq(users.email, credentials.email))

  if (!user || !(await verifyPassword(user.passwordHash, credentials.password))) {
    res.status(401).json({ error: 'invalid email or password' })
    return
  }

  if (!user.emailVerifiedAt) {
    res.status(403).json({ error: 'email not verified yet — check your inbox' })
    return
  }

  const token = generateSessionToken()
  const session = await createSession(token, user.id)
  setSessionCookie(res, token, session.expiresAt)

  res.status(200).json({ user: { id: user.id, email: user.email } })
})

// Restaura sessão no reload do browser (apps/web não tem outra forma de saber se o
// cookie já existente ainda é válido).
authRouter.get('/me', requireAuth, (req, res) => {
  res.status(200).json({ user: req.user })
})

// De propósito sem requireAuth: precisa funcionar mesmo com cookie ausente/expirado
// (idempotente), inclusive pra testar múltiplos usuários manualmente sem travar.
authRouter.post('/logout', async (req, res) => {
  const token: unknown = req.cookies?.[SESSION_COOKIE_NAME]
  if (typeof token === 'string' && token !== '') {
    const { session } = await validateSessionToken(token)
    if (session) {
      await invalidateSession(session.id)
    }
  }
  clearSessionCookie(res)
  res.status(204).send()
})
