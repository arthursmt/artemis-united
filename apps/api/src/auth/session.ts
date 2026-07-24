import { randomBytes, createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { sessions, users } from '../db/schema.js'

// Padrao recomendado pela documentacao da Lucia para substituir a lib
// (deprecada): token aleatorio enviado ao cliente, so o hash SHA-256 do
// token e persistido no banco. Sessao expira em 30 dias, com sliding
// expiration: se restar menos da metade da duracao, ela e renovada.
// Decisão #18 (Etapa 2) — política padrão, NÃO alterada pela Etapa 5.
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30
const SESSION_RENEWAL_THRESHOLD_MS = SESSION_DURATION_MS / 2

// Etapa 5 (plano mestre §4.9/decisão #41) — política separada, só pra
// sessões que passaram por 2FA (`isTwoFactorSession: true`). 24h rolantes:
// mesma mecânica de sliding expiration acima, só que com janela mais curta.
// Aplica-se por sessão/dispositivo (ver schema.ts, sessions.isTwoFactorSession)
// — nunca substitui a política padrão de sessões sem 2FA.
const TWO_FACTOR_SESSION_DURATION_MS = 1000 * 60 * 60 * 24
const TWO_FACTOR_SESSION_RENEWAL_THRESHOLD_MS = TWO_FACTOR_SESSION_DURATION_MS / 2

export const SESSION_COOKIE_NAME = 'session'

export interface SessionUser {
  id: string
  email: string
  twoFactorEnabled: boolean
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
  options?: { twoFactor?: boolean },
): Promise<{ id: string; userId: string; expiresAt: Date }> {
  const isTwoFactorSession = options?.twoFactor ?? false
  const durationMs = isTwoFactorSession ? TWO_FACTOR_SESSION_DURATION_MS : SESSION_DURATION_MS
  const session = {
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + durationMs),
    isTwoFactorSession,
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
      isTwoFactorSession: sessions.isTwoFactorSession,
      userEmail: users.email,
      userTwoFactorEnabled: users.twoFactorEnabled,
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

  const durationMs = row.isTwoFactorSession ? TWO_FACTOR_SESSION_DURATION_MS : SESSION_DURATION_MS
  const renewalThresholdMs = row.isTwoFactorSession
    ? TWO_FACTOR_SESSION_RENEWAL_THRESHOLD_MS
    : SESSION_RENEWAL_THRESHOLD_MS

  let expiresAt = row.expiresAt
  if (Date.now() >= expiresAt.getTime() - renewalThresholdMs) {
    expiresAt = new Date(Date.now() + durationMs)
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, sessionId))
  }

  return {
    session: { id: row.sessionId, userId: row.userId, expiresAt },
    user: { id: row.userId, email: row.userEmail, twoFactorEnabled: row.userTwoFactorEnabled },
  }
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId))
}

// Usado no reset de senha — trocar a senha deve derrubar qualquer sessão
// existente (inclusive em outros dispositivos), não só a que fez a troca.
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId))
}
