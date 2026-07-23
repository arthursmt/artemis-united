import { randomBytes, createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { emailVerificationTokens } from '../db/schema.js'

// Mesmo padrão de auth/session.ts: token aleatório entregue ao usuário, só o
// hash SHA-256 fica no banco. 24h de validade, uso único (consumido e apagado
// na confirmação).
const VERIFICATION_TOKEN_DURATION_MS = 1000 * 60 * 60 * 24

export function generateVerificationToken(): string {
  return randomBytes(20).toString('base64url')
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createEmailVerificationToken(token: string, userId: string): Promise<void> {
  await db.insert(emailVerificationTokens).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_DURATION_MS),
  })
}

// Retorna o userId se o token for válido e ainda não expirado, e o apaga (uso
// único) — ou null se inválido/expirado/já usado.
export async function consumeEmailVerificationToken(token: string): Promise<string | null> {
  const tokenHash = hashToken(token)

  const [row] = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.id, tokenHash))

  if (!row) {
    return null
  }

  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, tokenHash))

  if (Date.now() >= row.expiresAt.getTime()) {
    return null
  }

  return row.userId
}
