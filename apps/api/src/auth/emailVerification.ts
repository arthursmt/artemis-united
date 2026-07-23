import { randomBytes, createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { emailVerificationTokens } from '../db/schema.js'

// Mesmo padrão de auth/session.ts: token aleatório entregue ao usuário, só o
// hash SHA-256 fica no banco. 24h de validade, uso único (consumido e apagado
// na confirmação).
const VERIFICATION_TOKEN_DURATION_MS = 1000 * 60 * 60 * 24
// Cooldown de reenvio (Etapa 5, plano mestre §4.9/decisão #42) — mesma janela
// da validade do token em si (24h), por simplicidade: um pedido novo só faz
// sentido depois que o anterior expiraria de qualquer forma.
const RESEND_COOLDOWN_MS = VERIFICATION_TOKEN_DURATION_MS

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

export type ResendResult = { sent: true } | { sent: false; retryAfterSeconds: number }

// Reenvio (Etapa 5) — diferente da criação original no signup: aqui existe a
// possibilidade de já haver um token pendente, e precisa respeitar o cooldown
// de 24h entre pedidos. `id` é hash(token), não dá pra buscar por ele sem
// conhecer o token — busca por `userId` em vez disso.
export async function resendEmailVerificationToken(
  userId: string,
  newToken: string,
): Promise<ResendResult> {
  const [existing] = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, userId))

  if (existing) {
    const elapsedMs = Date.now() - existing.createdAt.getTime()
    if (elapsedMs < RESEND_COOLDOWN_MS) {
      return { sent: false, retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - elapsedMs) / 1000) }
    }
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId))
  }

  await createEmailVerificationToken(newToken, userId)
  return { sent: true }
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
