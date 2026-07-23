import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../auth/middleware.js'
import { db } from '../db/client.js'
import { businesses, financialStatements } from '../db/schema.js'
import { createAssessment, type MonthlyFinancials } from '../lib/bobEngineClient.js'

export const financialStatementsRouter = Router()

const MONTHLY_FIELDS = [
  'revenue',
  'directCosts',
  'operatingExpenses',
  'currentDebtService',
  'personalExtraIncome',
  'personalExpenses',
] as const

function parseMonthly(body: unknown): MonthlyFinancials | string {
  const source = (body ?? {}) as Record<string, unknown>
  const parsed = {} as MonthlyFinancials
  for (const field of MONTHLY_FIELDS) {
    const value = source[field]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return `${field} must be a number`
    }
    parsed[field] = value
  }
  return parsed
}

financialStatementsRouter.post('/', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }

  const [business] = await db.select().from(businesses).where(eq(businesses.ownerUserId, userId))
  if (!business) {
    res.status(409).json({ error: 'create a business before submitting a DRE' })
    return
  }

  const monthly = parseMonthly(req.body)
  if (typeof monthly === 'string') {
    res.status(400).json({ error: monthly })
    return
  }

  // Snapshot versionado — nunca sobrescreve uma linha existente, cada submissão é
  // uma nova linha (docs/architecture.md §1.2). Colunas numeric do drizzle esperam
  // string, não number (mesma convenção já usada em bob-engine/routes/assessments.ts).
  const [statement] = await db
    .insert(financialStatements)
    .values({
      businessId: business.id,
      revenue: monthly.revenue.toFixed(2),
      directCosts: monthly.directCosts.toFixed(2),
      operatingExpenses: monthly.operatingExpenses.toFixed(2),
      currentDebtService: monthly.currentDebtService.toFixed(2),
      personalExtraIncome: monthly.personalExtraIncome.toFixed(2),
      personalExpenses: monthly.personalExpenses.toFixed(2),
    })
    .returning()

  try {
    const result = await createAssessment({
      businessId: business.id,
      sectorSegment: business.sectorSegment,
      monthly,
    })
    res.status(201).json(result)
  } catch {
    // O DRE já foi salvo — não descarta o dado do usuário só porque o bob-engine
    // falhou nesta chamada. Quem consome pode tentar de novo ou usar o
    // financialStatementId pra investigar.
    res.status(502).json({
      error: 'financial data saved, but assessment could not be computed',
      financialStatementId: statement.id,
    })
  }
})
