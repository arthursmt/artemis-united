import { Router } from 'express'
import { db } from '../db/client.js'
import { assessments } from '../db/schema.js'
import { runAssessment, type MonthlyFinancials } from '../domain/assessment.js'
import { captureAssessmentAnomaly } from '../lib/observability.js'

export const assessmentsRouter = Router()

interface AssessmentRequestBody {
  businessId?: unknown
  sectorSegment?: unknown
  requestedAmount?: unknown
  monthly?: unknown
}

interface ParsedRequest {
  businessId: string
  sectorSegment: string
  requestedAmount: number | null
  monthly: MonthlyFinancials
}

const MONTHLY_FIELDS = [
  'revenue',
  'directCosts',
  'operatingExpenses',
  'currentDebtService',
  'personalExtraIncome',
  'personalExpenses',
] as const

function parseRequest(body: unknown): ParsedRequest | string {
  const { businessId, sectorSegment, requestedAmount, monthly } = (body ?? {}) as AssessmentRequestBody

  if (typeof businessId !== 'string' || businessId.trim() === '') {
    return 'businessId is required'
  }
  if (typeof sectorSegment !== 'string' || sectorSegment.trim() === '') {
    return 'sectorSegment is required'
  }
  if (typeof monthly !== 'object' || monthly === null) {
    return 'monthly is required'
  }

  const parsedMonthly = {} as MonthlyFinancials
  for (const field of MONTHLY_FIELDS) {
    const value = (monthly as Record<string, unknown>)[field]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return `monthly.${field} must be a number`
    }
    parsedMonthly[field] = value
  }

  if (requestedAmount !== undefined && (typeof requestedAmount !== 'number' || requestedAmount < 0)) {
    return 'requestedAmount must be a non-negative number when provided'
  }

  return {
    businessId,
    sectorSegment,
    requestedAmount: typeof requestedAmount === 'number' ? requestedAmount : null,
    monthly: parsedMonthly,
  }
}

assessmentsRouter.post('/', async (req, res) => {
  const parsed = parseRequest(req.body)
  if (typeof parsed === 'string') {
    res.status(400).json({ error: parsed })
    return
  }

  const result = runAssessment(parsed.sectorSegment, parsed.monthly)

  if (!result.sectorFound) {
    // Regra de fallback (Seção 1 do documento de parâmetros): setor fora dos 14
    // documentados ainda é calculado, sem parâmetro de segmentação — não é erro.
    captureAssessmentAnomaly('assessment.sector_fallback', {
      businessId: parsed.businessId,
      sectorSegment: parsed.sectorSegment,
    })
  }

  if (result.exceedsMicroloanCeiling) {
    // Sinal estruturado para o front-end alertar o usuário (Etapa 3 é só API —
    // nenhum componente de UI é implementado aqui). Log via stack já decidida
    // (Sentry + Better Stack, decisão #12), sem mecanismo de log novo.
    captureAssessmentAnomaly('assessment.exceeds_microloan_ceiling', {
      businessId: parsed.businessId,
      sectorSegment: parsed.sectorSegment,
      recommendedAmount: result.recommendedAmount,
    })
  }

  // requestedAmount é nullable — nenhuma tela pede "quanto você quer pedir"
  // explicitamente ainda. Sem valor no payload, grava null (não usa
  // recommendedAmount como placeholder — decisão fechada).
  const [row] = await db
    .insert(assessments)
    .values({
      businessId: parsed.businessId,
      status: 'completed',
      requestedAmount: parsed.requestedAmount !== null ? parsed.requestedAmount.toFixed(2) : null,
      inputSnapshot: parsed.monthly,
      sectorSegment: parsed.sectorSegment,
      recommendedAmount: result.recommendedAmount.toFixed(2),
      // score: não populado — definição pendente de dado real de teste para decidir
      // como tratar (ver services/bob-engine/src/domain/assessment.ts). Coluna
      // permanece no schema, só não é escrita aqui.
      confidenceLevel: result.confidenceLevel,
    })
    .returning()

  res.status(201).json({
    id: row.id,
    businessId: row.businessId,
    sectorSegment: row.sectorSegment,
    status: row.status,
    currency: row.currency,
    requestedAmount: row.requestedAmount,
    recommendedAmount: row.recommendedAmount,
    confidenceLevel: row.confidenceLevel,
    score: row.score,
    exceedsMicroloanCeiling: result.exceedsMicroloanCeiling,
    marginSanityTriggered: result.marginSanityTriggered,
    sectorFound: result.sectorFound,
  })
})
