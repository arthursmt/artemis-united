import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { loginAttempts } from '../db/schema.js'

// Falhas livres antes do primeiro bloqueio — não pune um typo isolado.
const FREE_ATTEMPTS = 4
// Primeiro bloqueio dura isso, dobra a cada falha seguinte, até o teto.
const BASE_LOCKOUT_MS = 1000 * 30
const MAX_LOCKOUT_MS = 1000 * 60 * 15

// Chave combinada IP+email (nunca separado — ver comentário do schema). Hash
// em vez de guardar as duas colunas cruas: a única operação precisa é
// igualdade exata desse par, nunca "listar por IP" isolado.
function attemptKey(ip: string, email: string): string {
  return createHash('sha256').update(`${ip}|${email}`).digest('hex')
}

function lockoutDurationMs(failedCount: number): number {
  if (failedCount <= FREE_ATTEMPTS) return 0
  const step = failedCount - FREE_ATTEMPTS - 1
  return Math.min(BASE_LOCKOUT_MS * 2 ** step, MAX_LOCKOUT_MS)
}

export type LoginLockoutStatus = { locked: false } | { locked: true; retryAfterSeconds: number }

// Chamado ANTES de verificar a senha — um bloqueio ativo barra até uma senha
// certa, senão não é bloqueio de verdade (só atraparia quem já errou mesmo).
export async function checkLoginLockout(ip: string, email: string): Promise<LoginLockoutStatus> {
  const [existing] = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.attemptKey, attemptKey(ip, email)))

  if (!existing || !existing.lockedUntil) {
    return { locked: false }
  }

  const remainingMs = existing.lockedUntil.getTime() - Date.now()
  if (remainingMs <= 0) {
    return { locked: false }
  }

  return { locked: true, retryAfterSeconds: Math.ceil(remainingMs / 1000) }
}

export async function recordFailedLogin(ip: string, email: string): Promise<void> {
  const key = attemptKey(ip, email)
  const [existing] = await db.select().from(loginAttempts).where(eq(loginAttempts.attemptKey, key))
  const failedCount = (existing?.failedCount ?? 0) + 1
  const durationMs = lockoutDurationMs(failedCount)
  const lockedUntil = durationMs > 0 ? new Date(Date.now() + durationMs) : null

  await db
    .insert(loginAttempts)
    .values({ attemptKey: key, failedCount, lockedUntil })
    .onConflictDoUpdate({
      target: loginAttempts.attemptKey,
      set: { failedCount, lockedUntil, updatedAt: new Date() },
    })
}

// Login bem-sucedido apaga o histórico de falhas — reset é só por sucesso,
// nunca automático por tempo (o bloqueio expira, o contador de falhas não).
export async function clearLoginAttempts(ip: string, email: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.attemptKey, attemptKey(ip, email)))
}
