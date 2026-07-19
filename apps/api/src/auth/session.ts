import { randomBytes, createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { sessions, users } from '../db/schema.js'

// Padrao recomendado pela documentacao da Lucia para substituir a lib
// (deprecada): token aleatorio enviado ao cliente, so o hash SHA-256 do
// token e persistido no banco. Sessao expira em 30 dias, com sliding
// expiration: se restar menos da metade da duracao, ela e renovada.
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30
const SESSION_RENEWAL_THRESHOLD_MS = SESSION_DURATION_MS / 2

export const SESSION_COOKIE_NAME = 'session'

export interface SessionUser {
  id: string
  email: string
}

export interface SessionValidationResult {
  session: { id: string; userId: string; expiresAt: Date } | null
  user: SessionUser | null
}

export function generateSessionToken(): string {
  return randomBytes(20).toString('base64url')
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(
  token: string,
  userId: string,
): Promise<{ id: string; userId: string; expiresAt: Date }> {
  const session = {
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  }
  await db.insert(sessions).values(session)
  return session
}

export async function validateSessionToken(token: string): Promise<SessionValidationResult> {
  const sessionId = hashToken(token)

  const rows = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
      userEmail: users.email,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))

  const row = rows[0]
  if (!row) {
    return { session: null, user: null }
  }

  if (Date.now() >= row.expiresAt.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId))
    return { session: null, user: null }
  }

  let expiresAt = row.expiresAt
  if (Date.now() >= expiresAt.getTime() - SESSION_RENEWAL_THRESHOLD_MS) {
    expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, sessionId))
  }

  return {
    session: { id: row.sessionId, userId: row.userId, expiresAt },
    user: { id: row.userId, email: row.userEmail },
  }
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId))
}
