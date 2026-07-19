import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import { setSessionCookie } from '../auth/cookies.js'
import { hashPassword, isPasswordValid, verifyPassword } from '../auth/password.js'
import { createSession, generateSessionToken } from '../auth/session.js'

export const authRouter = Router()

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

authRouter.post('/signup', async (req, res) => {
  const credentials = parseCredentials(req.body)
  if (!credentials) {
    res.status(400).json({ error: 'email and password are required' })
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
    .values({ email: credentials.email, passwordHash })
    .returning({ id: users.id, email: users.email })

  const token = generateSessionToken()
  const session = await createSession(token, user.id)
  setSessionCookie(res, token, session.expiresAt)

  res.status(201).json({ user })
})

authRouter.post('/login', async (req, res) => {
  const credentials = parseCredentials(req.body)
  if (!credentials) {
    res.status(400).json({ error: 'email and password are required' })
    return
  }

  const [user] = await db
    .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, credentials.email))

  if (!user || !(await verifyPassword(user.passwordHash, credentials.password))) {
    res.status(401).json({ error: 'invalid email or password' })
    return
  }

  const token = generateSessionToken()
  const session = await createSession(token, user.id)
  setSessionCookie(res, token, session.expiresAt)

  res.status(200).json({ user: { id: user.id, email: user.email } })
})
