import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { OUTRO_SEGMENT, SECTOR_SEGMENTS } from '@artemis-united/shared-types'
import { requireAuth } from '../auth/middleware.js'
import { db } from '../db/client.js'
import { businesses } from '../db/schema.js'

export const businessesRouter = Router()

const VALID_SEGMENTS: ReadonlySet<string> = new Set<string>([...SECTOR_SEGMENTS, OUTRO_SEGMENT])

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

  // Trava V1: um negócio por usuário (plano mestre §1.2, decisão fechada) — regra de
  // aplicação, não de schema (schema segue permitindo 1:N para o futuro).
  const existing = await findBusinessByOwner(userId)
  if (existing) {
    res.status(409).json({ error: 'you already have a business registered' })
    return
  }

  const [business] = await db
    .insert(businesses)
    .values({ ownerUserId: userId, name: parsed.name, sectorSegment: parsed.sectorSegment })
    .returning()

  res.status(201).json({ business })
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
