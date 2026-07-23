import { randomInt, createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { twoFactorCodes } from '../db/schema.js'

const CODE_LENGTH = 6
// 10 minutos — validade do código em si. Diferente da validade da SESSÃO
// criada depois que o código é aceito (24h rolantes, ver auth/session.ts) —
// são dois prazos distintos, não confundir.
const CODE_EXPIRATION_MS = 1000 * 60 * 10
// 60 segundos — cooldown entre pedidos de código (geração inicial no login E
// reenvio explícito passam pela mesma checagem). Curto de propósito: é um
// código de login em andamento, não verificação de cadastro (24h, tarefa 2)
// nem reset de senha (1h) — o usuário está esperando na tela agora.
const RESEND_COOLDOWN_MS = 1000 * 60

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

export function generateTwoFactorCode(): string {
  return randomInt(0, 10 ** CODE_LENGTH).toString().padStart(CODE_LENGTH, '0')
}

export type CreateTwoFactorCodeResult = { created: true } | { created: false; retryAfterSeconds: number }

// Cria (ou substitui) o código pendente do usuário. Só um código pendente por
// vez — pedir de novo antes do cooldown passar não cria um segundo, retorna
// quanto falta esperar.
export async function createTwoFactorCode(userId: string, code: string): Promise<CreateTwoFactorCodeResult> {
  const [existing] = await db.select().from(twoFactorCodes).where(eq(twoFactorCodes.userId, userId))

  if (existing) {
    const elapsedMs = Date.now() - existing.createdAt.getTime()
    if (elapsedMs < RESEND_COOLDOWN_MS) {
      return { created: false, retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - elapsedMs) / 1000) }
    }
    await db.delete(twoFactorCodes).where(eq(twoFactorCodes.userId, userId))
  }

  await db.insert(twoFactorCodes).values({
    userId,
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + CODE_EXPIRATION_MS),
  })

  return { created: true }
}

// Consome o código pendente do usuário (uso único — apaga a linha
// independente do resultado). Retorna true só se existia, não tinha expirado,
// e batia com o código informado.
export async function consumeTwoFactorCode(userId: string, code: string): Promise<boolean> {
  const [existing] = await db.select().from(twoFactorCodes).where(eq(twoFactorCodes.userId, userId))
  if (!existing) {
    return false
  }

  await db.delete(twoFactorCodes).where(eq(twoFactorCodes.userId, userId))

  if (Date.now() >= existing.expiresAt.getTime()) {
    return false
  }

  return existing.codeHash === hashCode(code)
}
