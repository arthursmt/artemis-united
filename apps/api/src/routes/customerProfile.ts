import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { US_STATE_CODES } from '@artemis-united/shared-types'
import { requireAuth } from '../auth/middleware.js'
import { db } from '../db/client.js'
import { customerProfiles } from '../db/schema.js'

export const customerProfileRouter = Router()

const VALID_STATES: ReadonlySet<string> = new Set<string>(US_STATE_CODES)
const VALID_MARITAL_STATUSES: ReadonlySet<string> = new Set([
  'single',
  'married',
  'divorced',
  'widowed',
  'separated',
])
const ZIP_CODE_PATTERN = /^\d{5}(-\d{4})?$/

interface CustomerProfileInput {
  dateOfBirth: string
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  zipCode: string
  maritalStatus: string
  hasChildren: boolean
  householdSize: number | null
  alternatePhone: string
}

function parseCustomerProfile(body: unknown): CustomerProfileInput | string {
  const b = (body ?? {}) as Record<string, unknown>

  if (typeof b.dateOfBirth !== 'string' || Number.isNaN(Date.parse(b.dateOfBirth))) {
    return 'dateOfBirth must be a valid date'
  }
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
  if (typeof b.maritalStatus !== 'string' || !VALID_MARITAL_STATUSES.has(b.maritalStatus)) {
    return 'maritalStatus must be one of: single, married, divorced, widowed, separated'
  }
  if (typeof b.hasChildren !== 'boolean') {
    return 'hasChildren must be a boolean'
  }
  if (
    b.householdSize !== undefined &&
    b.householdSize !== null &&
    (typeof b.householdSize !== 'number' || !Number.isInteger(b.householdSize) || b.householdSize < 1)
  ) {
    return 'householdSize must be a positive integer when provided'
  }
  if (typeof b.alternatePhone !== 'string' || b.alternatePhone.trim() === '') {
    return 'alternatePhone is required'
  }

  return {
    dateOfBirth: b.dateOfBirth,
    addressLine1: b.addressLine1.trim(),
    addressLine2: typeof b.addressLine2 === 'string' ? b.addressLine2.trim() : null,
    city: b.city.trim(),
    state: b.state,
    zipCode: b.zipCode,
    maritalStatus: b.maritalStatus,
    hasChildren: b.hasChildren,
    householdSize: typeof b.householdSize === 'number' ? b.householdSize : null,
    alternatePhone: b.alternatePhone.trim(),
  }
}

async function findProfileByUser(userId: string) {
  const [profile] = await db.select().from(customerProfiles).where(eq(customerProfiles.userId, userId))
  return profile
}

customerProfileRouter.post('/', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }

  const parsed = parseCustomerProfile(req.body)
  if (typeof parsed === 'string') {
    res.status(400).json({ error: parsed })
    return
  }

  const existing = await findProfileByUser(userId)
  if (existing) {
    res.status(409).json({ error: 'customer profile already exists — use PUT to update it' })
    return
  }

  const [profile] = await db
    .insert(customerProfiles)
    .values({
      userId,
      dateOfBirth: parsed.dateOfBirth,
      addressLine1: parsed.addressLine1,
      addressLine2: parsed.addressLine2,
      city: parsed.city,
      state: parsed.state,
      zipCode: parsed.zipCode,
      maritalStatus: parsed.maritalStatus as 'single' | 'married' | 'divorced' | 'widowed' | 'separated',
      hasChildren: parsed.hasChildren,
      householdSize: parsed.householdSize,
      alternatePhone: parsed.alternatePhone,
    })
    .returning()

  res.status(201).json({ profile })
})

customerProfileRouter.get('/me', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }

  const profile = await findProfileByUser(userId)
  if (!profile) {
    res.status(404).json({ error: 'no customer profile found' })
    return
  }
  res.status(200).json({ profile })
})

// Tarefa 6 (Configurações — Dados Pessoais): edição do perfil já criado no
// onboarding (tarefa 4). Não cria — 404 se ainda não existir.
customerProfileRouter.put('/me', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }

  const existing = await findProfileByUser(userId)
  if (!existing) {
    res.status(404).json({ error: 'no customer profile found — create one first' })
    return
  }

  const parsed = parseCustomerProfile(req.body)
  if (typeof parsed === 'string') {
    res.status(400).json({ error: parsed })
    return
  }

  const [profile] = await db
    .update(customerProfiles)
    .set({
      dateOfBirth: parsed.dateOfBirth,
      addressLine1: parsed.addressLine1,
      addressLine2: parsed.addressLine2,
      city: parsed.city,
      state: parsed.state,
      zipCode: parsed.zipCode,
      maritalStatus: parsed.maritalStatus as 'single' | 'married' | 'divorced' | 'widowed' | 'separated',
      hasChildren: parsed.hasChildren,
      householdSize: parsed.householdSize,
      alternatePhone: parsed.alternatePhone,
      updatedAt: new Date(),
    })
    .where(eq(customerProfiles.userId, userId))
    .returning()

  res.status(200).json({ profile })
})
