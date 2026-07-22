import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { OUTRO_SEGMENT, SECTOR_SEGMENTS } from '@artemis-united/shared-types'
import { requireAuth } from '../auth/middleware.js'
import { db } from '../db/client.js'
import { businesses } from '../db/schema.js'

export const businessesRouter = Router()

const VALID_SEGMENTS: ReadonlySet<string> = new Set<string>([...SECTOR_SEGMENTS, OUTRO_SEGMENT])

// Código de unique_violation do Postgres — usado pra reconhecer a corrida coberta
// pela constraint UNIQUE em businesses.owner_user_id (cinto de segurança da checagem
// 409 abaixo, ver comentário no schema).
const POSTGRES_UNIQUE_VIOLATION = '23505'

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === POSTGRES_UNIQUE_VIOLATION
}

interface CreateBusinessBody {
  name?: unknown
  sectorSegment?: unknown
}

function parseCreateBusiness(body: unknown): { name: string; sectorSegment: string } | string {
  const { name, sectorSegment } = (body ?? {}) as CreateBusinessBody
  if (typeof name !== 'string' || name.trim() === '') {
    return 'name is required'
  }
  if (typeof sectorSegment !== 'string' || !VALID_SEGMENTS.has(sectorSegment)) {
    return 'sectorSegment must be one of the known sector slugs or "outro"'
  }
  return { name: name.trim(), sectorSegment }
}

async function findBusinessByOwner(ownerUserId: string) {
  const [business] = await db.select().from(businesses).where(eq(businesses.ownerUserId, ownerUserId))
  return business
}

businessesRouter.post('/', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }

  const parsed = parseCreateBusiness(req.body)
  if (typeof parsed === 'string') {
    res.status(400).json({ error: parsed })
    return
  }

  // Trava V1: um negócio por usuário (plano mestre §1.2, decisão fechada). Checagem
  // primária aqui; a constraint UNIQUE em owner_user_id (db/schema.ts) é o cinto de
  // segurança pra corrida entre duas requisições simultâneas — tratada no catch abaixo.
  const existing = await findBusinessByOwner(userId)
  if (existing) {
    res.status(409).json({ error: 'you already have a business registered' })
    return
  }

  try {
    const [business] = await db
      .insert(businesses)
      .values({ ownerUserId: userId, name: parsed.name, sectorSegment: parsed.sectorSegment })
      .returning()

    res.status(201).json({ business })
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: 'you already have a business registered' })
      return
    }
    // Express 4 não captura rejeições de handler async sozinho — sem isto, um erro
    // inesperado aqui deixaria a requisição pendurada em vez de responder 500.
    console.error('[api] unexpected error creating business', err)
    res.status(500).json({ error: 'unexpected error' })
  }
})

businessesRouter.get('/me', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }

  const business = await findBusinessByOwner(userId)
  if (!business) {
    res.status(404).json({ error: 'no business found' })
    return
  }
  res.status(200).json({ business })
})
