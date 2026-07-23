import { randomBytes, createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { passwordResetTokens } from '../db/schema.js'

// Mesmo padrão de auth/session.ts e auth/emailVerification.ts: token aleatório
// entregue ao usuário, só o hash SHA-256 fica no banco. 1h de validade (mais
// curto que a verificação de email — reset de senha é mais sensível).
const RESET_TOKEN_DURATION_MS = 1000 * 60 * 60

export function generateResetToken(): string {
  return randomBytes(20).toString('base64url')
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// Cada solicitação de reset invalida qualquer token anterior do mesmo usuário —
// só o link mais recente do email funciona.
export async function createPasswordResetToken(token: string, userId: string): Promise<void> {
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId))
  await db.insert(passwordResetTokens).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + RESET_TOKEN_DURATION_MS),
  })
}

// Retorna o userId se o token for válido e ainda não expirado, e o apaga (uso
// único) — ou null se inválido/expirado/já usado.
export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const tokenHash = hashToken(token)

  const [row] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.id, tokenHash))

  if (!row) {
    return null
  }

  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, tokenHash))

  if (Date.now() >= row.expiresAt.getTime()) {
    return null
  }

  return row.userId
}
