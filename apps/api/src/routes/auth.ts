import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import { clearSessionCookie, setSessionCookie } from '../auth/cookies.js'
import {
  consumeEmailVerificationToken,
  createEmailVerificationToken,
  generateVerificationToken,
  resendEmailVerificationToken,
} from '../auth/emailVerification.js'
import { requireAuth } from '../auth/middleware.js'
import { hashPassword, isPasswordValid, verifyPassword } from '../auth/password.js'
import { consumePasswordResetToken, createPasswordResetToken, generateResetToken } from '../auth/passwordReset.js'
import {
  createSession,
  generateSessionToken,
  invalidateAllUserSessions,
  invalidateSession,
  SESSION_COOKIE_NAME,
  validateSessionToken,
} from '../auth/session.js'
import { consumeTwoFactorCode, createTwoFactorCode, generateTwoFactorCode } from '../auth/twoFactor.js'
import { passwordResetEmail, sendEmail, twoFactorCodeEmail, verificationEmail } from '../lib/email/index.js'

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
  confirmPassword?: unknown
}

authRouter.post('/signup', async (req, res) => {
  const credentials = parseCredentials(req.body)
  if (!credentials) {
    res.status(400).json({ error: 'email and password are required' })
    return
  }

  // Confirmação de senha (plano mestre §4.1: "Senha, Repetir senha") —
  // checagem no servidor, não só no client (o front já bloqueia o submit se
  // não bater, mas a API não confia só nisso, mesmo padrão do acceptedTerms
  // logo abaixo).
  const confirmPassword = (req.body as SignupBody)?.confirmPassword
  if (typeof confirmPassword !== 'string' || confirmPassword !== credentials.password) {
    res.status(400).json({ error: 'password and confirmation do not match' })
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
  await sendEmail({
    to: user.email,
    ...verificationEmail(`${webAppUrl()}/?verify=${verificationToken}`),
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
      twoFactorEnabled: users.twoFactorEnabled,
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

  // Etapa 5 (plano mestre §4.9/decisão #40): 2FA é opt-in por usuário. Senha
  // certa + 2FA ativo não cria sessão ainda — gera o código, manda por email
  // e devolve `twoFactorRequired`. A sessão só nasce em POST /verify-2fa, e
  // já nasce com `twoFactor: true` (24h rolantes, não os 30 dias padrão).
  // `userId` só é devolvido aqui porque a senha já foi validada — sem a
  // senha certa, um atacante nunca chega nesta resposta.
  if (user.twoFactorEnabled) {
    const code = generateTwoFactorCode()
    const result = await createTwoFactorCode(user.id, code)
    if (!result.created) {
      res.status(429).json({
        error: 'a code was already sent, please wait before requesting another',
        retryAfterSeconds: result.retryAfterSeconds,
      })
      return
    }

    await sendEmail({ to: user.email, ...twoFactorCodeEmail(code) })
    res.status(200).json({ twoFactorRequired: true, userId: user.id })
    return
  }

  const token = generateSessionToken()
  const session = await createSession(token, user.id)
  setSessionCookie(res, token, session.expiresAt)

  res.status(200).json({ user: { id: user.id, email: user.email } })
})

authRouter.post('/verify-2fa', async (req, res) => {
  const body = req.body as { userId?: unknown; code?: unknown }
  if (typeof body?.userId !== 'string' || body.userId === '') {
    res.status(400).json({ error: 'userId is required' })
    return
  }
  if (typeof body.code !== 'string' || body.code === '') {
    res.status(400).json({ error: 'code is required' })
    return
  }

  const valid = await consumeTwoFactorCode(body.userId, body.code)
  if (!valid) {
    res.status(400).json({ error: 'invalid or expired code' })
    return
  }

  const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, body.userId))
  if (!user) {
    res.status(400).json({ error: 'invalid or expired code' })
    return
  }

  const token = generateSessionToken()
  const session = await createSession(token, user.id, { twoFactor: true })
  setSessionCookie(res, token, session.expiresAt)

  res.status(200).json({ user })
})

authRouter.post('/resend-2fa', async (req, res) => {
  const body = req.body as { userId?: unknown }
  if (typeof body?.userId !== 'string' || body.userId === '') {
    res.status(400).json({ error: 'userId is required' })
    return
  }

  const [user] = await db
    .select({ id: users.id, email: users.email, twoFactorEnabled: users.twoFactorEnabled })
    .from(users)
    .where(eq(users.id, body.userId))

  if (!user || !user.twoFactorEnabled) {
    res.status(400).json({ error: 'invalid request' })
    return
  }

  const code = generateTwoFactorCode()
  const result = await createTwoFactorCode(user.id, code)
  if (!result.created) {
    res.status(429).json({
      error: 'a code was already sent, please wait before requesting another',
      retryAfterSeconds: result.retryAfterSeconds,
    })
    return
  }

  await sendEmail({ to: user.email, ...twoFactorCodeEmail(code) })
  res.status(200).json({ sent: true })
})

// Tarefa (Configurações — Segurança): liga/desliga 2FA para o usuário
// autenticado. Por usuário, não por sessão — afeta igualmente todo login
// futuro desse usuário, em qualquer dispositivo (ver comentário em
// db/schema.ts sobre a diferença para `sessions.isTwoFactorSession`).
authRouter.post('/two-factor/toggle', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }

  const enabled = (req.body as { enabled?: unknown })?.enabled
  if (typeof enabled !== 'boolean') {
    res.status(400).json({ error: 'enabled must be a boolean' })
    return
  }

  await db.update(users).set({ twoFactorEnabled: enabled }).where(eq(users.id, userId))

  res.status(200).json({ twoFactorEnabled: enabled })
})

// Etapa 5 (plano mestre §4.9/decisão #42) — reenvio de verificação de
// cadastro. Diferente de propósito do forgot-password logo abaixo: aqui o
// usuário já revelou o próprio email pra criar a conta (signup já responde
// 409 se o email existe), então uma resposta genérica não protegeria nada e
// só pioraria a UX — instrução explícita: mensagem clara de "aguarde X",
// nunca silêncio nem erro genérico.
authRouter.post('/resend-verification', async (req, res) => {
  const email = (req.body as { email?: unknown })?.email
  if (typeof email !== 'string' || email.trim() === '') {
    res.status(400).json({ error: 'email is required' })
    return
  }
  const normalizedEmail = email.trim().toLowerCase()

  const [user] = await db
    .select({ id: users.id, email: users.email, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.email, normalizedEmail))

  if (!user) {
    res.status(404).json({ error: 'no account found for that email' })
    return
  }

  if (user.emailVerifiedAt) {
    res.status(400).json({ error: 'email already verified' })
    return
  }

  const verificationToken = generateVerificationToken()
  const result = await resendEmailVerificationToken(user.id, verificationToken)
  if (!result.sent) {
    res.status(429).json({
      error: 'a verification email was already sent, please wait before requesting another',
      retryAfterSeconds: result.retryAfterSeconds,
    })
    return
  }

  await sendEmail({
    to: user.email,
    ...verificationEmail(`${webAppUrl()}/?verify=${verificationToken}`),
  })

  res.status(200).json({ message: 'verification email sent' })
})

authRouter.post('/forgot-password', async (req, res) => {
  const email = (req.body as { email?: unknown })?.email
  if (typeof email !== 'string' || email.trim() === '') {
    res.status(400).json({ error: 'email is required' })
    return
  }
  const normalizedEmail = email.trim().toLowerCase()

  const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, normalizedEmail))

  // Resposta genérica sempre — não revela se o email existe ou não (evita
  // enumeração de contas). Só envia o email (stub) se o usuário existir de
  // verdade.
  if (user) {
    const resetToken = generateResetToken()
    await createPasswordResetToken(resetToken, user.id)
    await sendEmail({
      to: user.email,
      ...passwordResetEmail(`${webAppUrl()}/?reset=${resetToken}`),
    })
  }

  res.status(200).json({ message: 'if that email is registered, a reset link was sent' })
})

authRouter.post('/reset-password', async (req, res) => {
  const body = req.body as { token?: unknown; newPassword?: unknown }
  if (typeof body?.token !== 'string' || body.token === '') {
    res.status(400).json({ error: 'token is required' })
    return
  }
  if (typeof body.newPassword !== 'string' || !isPasswordValid(body.newPassword)) {
    res.status(400).json({
      error:
        'password must be at least 8 characters and include an uppercase letter, a lowercase letter, a digit, and a special character',
    })
    return
  }

  const userId = await consumePasswordResetToken(body.token)
  if (!userId) {
    res.status(400).json({ error: 'invalid or expired token' })
    return
  }

  const passwordHash = await hashPassword(body.newPassword)
  // Completar um reset de senha via link de email prova posse da caixa de
  // entrada, igual à verificação de cadastro — marca emailVerifiedAt aqui
  // também, pra uma conta nunca verificada não ficar presa (login normal
  // continua bloqueado pra conta não verificada, mas o reset por si só já é
  // prova de acesso ao email).
  const [user] = await db
    .update(users)
    .set({ passwordHash, emailVerifiedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ id: users.id, email: users.email })

  // Troca de senha derruba qualquer sessão existente (inclusive outros
  // dispositivos) — depois loga de novo com a sessão nova.
  await invalidateAllUserSessions(user.id)

  const sessionToken = generateSessionToken()
  const session = await createSession(sessionToken, user.id)
  setSessionCookie(res, sessionToken, session.expiresAt)

  res.status(200).json({ user })
})

// Tarefa 8 (Configurações — Segurança): troca de senha exigindo a senha
// atual — diferente do reset (tarefa 3), que não exige nada além do token de
// email porque o usuário já provou não ter acesso à conta.
authRouter.post('/change-password', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }

  const body = req.body as { currentPassword?: unknown; newPassword?: unknown }
  if (typeof body?.currentPassword !== 'string' || body.currentPassword === '') {
    res.status(400).json({ error: 'currentPassword is required' })
    return
  }
  if (typeof body.newPassword !== 'string' || !isPasswordValid(body.newPassword)) {
    res.status(400).json({
      error:
        'password must be at least 8 characters and include an uppercase letter, a lowercase letter, a digit, and a special character',
    })
    return
  }

  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))

  if (!user || !(await verifyPassword(user.passwordHash, body.currentPassword))) {
    res.status(401).json({ error: 'current password is incorrect' })
    return
  }

  const passwordHash = await hashPassword(body.newPassword)
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId))

  // Derruba qualquer sessão existente (inclusive outros dispositivos) e loga
  // de novo com uma sessão nova — mesmo padrão do reset de senha (tarefa 3),
  // pra não deixar o dispositivo atual deslogado no meio da própria troca.
  await invalidateAllUserSessions(userId)
  const sessionToken = generateSessionToken()
  const session = await createSession(sessionToken, userId)
  setSessionCookie(res, sessionToken, session.expiresAt)

  res.status(200).json({ message: 'password changed' })
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
