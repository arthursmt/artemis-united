import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { OUTRO_SEGMENT, SECTOR_SEGMENTS, US_STATE_CODES } from '@artemis-united/shared-types'
import { requireAuth } from '../auth/middleware.js'
import { db } from '../db/client.js'
import { businesses } from '../db/schema.js'

export const businessesRouter = Router()

const VALID_SEGMENTS: ReadonlySet<string> = new Set<string>([...SECTOR_SEGMENTS, OUTRO_SEGMENT])
const VALID_STATES: ReadonlySet<string> = new Set<string>(US_STATE_CODES)
const ZIP_CODE_PATTERN = /^\d{5}(-\d{4})?$/

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

interface BusinessDetailsInput {
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  zipCode: string
  yearsInBusiness: number
  yearsOfIndustryExperience: number
  phone: string | null
  numberOfEmployees: number
}

function parseBusinessDetails(body: unknown): BusinessDetailsInput | string {
  const b = (body ?? {}) as Record<string, unknown>

  if (typeof b.addressLine1 !== 'string' || b.addressLine1.trim() === '') {
    return 'addressLine1 is required'
  }
  if (b.addressLine2 !== undefined && b.addressLine2 !== null && typeof b.addressLine2 !== 'string') {
    return 'addressLine2 must be a string when provided'
  }
  if (typeof b.city !== 'string' || b.city.trim() === '') {
    return 'city is required'
  }
  if (typeof b.state !== 'string' || !VALID_STATES.has(b.state)) {
    return 'state must be a valid US state code'
  }
  if (typeof b.zipCode !== 'string' || !ZIP_CODE_PATTERN.test(b.zipCode)) {
    return 'zipCode must be a valid US ZIP code'
  }
  if (typeof b.yearsInBusiness !== 'number' || !Number.isInteger(b.yearsInBusiness) || b.yearsInBusiness < 0) {
    return 'yearsInBusiness must be a non-negative integer'
  }
  if (
    typeof b.yearsOfIndustryExperience !== 'number' ||
    !Number.isInteger(b.yearsOfIndustryExperience) ||
    b.yearsOfIndustryExperience < 0
  ) {
    return 'yearsOfIndustryExperience must be a non-negative integer'
  }
  if (b.phone !== undefined && b.phone !== null && typeof b.phone !== 'string') {
    return 'phone must be a string when provided'
  }
  if (
    typeof b.numberOfEmployees !== 'number' ||
    !Number.isInteger(b.numberOfEmployees) ||
    b.numberOfEmployees < 0
  ) {
    return 'numberOfEmployees must be a non-negative integer'
  }

  return {
    addressLine1: b.addressLine1.trim(),
    addressLine2: typeof b.addressLine2 === 'string' ? b.addressLine2.trim() : null,
    city: b.city.trim(),
    state: b.state,
    zipCode: b.zipCode,
    yearsInBusiness: b.yearsInBusiness,
    yearsOfIndustryExperience: b.yearsOfIndustryExperience,
    phone: typeof b.phone === 'string' && b.phone.trim() !== '' ? b.phone.trim() : null,
    numberOfEmployees: b.numberOfEmployees,
  }
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
    // Qualquer outro erro: relança e deixa o error-handling middleware global
    // (apps/api/src/index.ts, via express-async-errors) responder 500.
    throw err
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

// Segundo passo do onboarding de negócio (Etapa 5, seção 4.4) — estende o
// negócio já criado (nome+setor, Etapa 4) com endereço/anos/funcionários.
// Não é criação: 404 se o negócio ainda não existe (precisa passar pelo POST
// / primeiro).
businessesRouter.put('/me', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }

  const existing = await findBusinessByOwner(userId)
  if (!existing) {
    res.status(404).json({ error: 'no business found — create one first' })
    return
  }

  const parsed = parseBusinessDetails(req.body)
  if (typeof parsed === 'string') {
    res.status(400).json({ error: parsed })
    return
  }

  const [business] = await db
    .update(businesses)
    .set({
      addressLine1: parsed.addressLine1,
      addressLine2: parsed.addressLine2,
      city: parsed.city,
      state: parsed.state,
      zipCode: parsed.zipCode,
      yearsInBusiness: parsed.yearsInBusiness,
      yearsOfIndustryExperience: parsed.yearsOfIndustryExperience,
      phone: parsed.phone,
      numberOfEmployees: parsed.numberOfEmployees,
      updatedAt: new Date(),
    })
    .where(eq(businesses.ownerUserId, userId))
    .returning()

  res.status(200).json({ business })
})
