import { Router } from 'express'
import { desc, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { assessments } from '../db/schema.js'
import { runAssessment, type MonthlyFinancials } from '../domain/assessment.js'
import { captureAssessmentAnomaly } from '../lib/observability.js'

function toNullableNumber(value: string | null): number | null {
  return value !== null ? Number(value) : null
}

export const assessmentsRouter = Router()

// Nota: se GET /:id (rascunho em docs/architecture.md §1.1) for adicionado no futuro,
// precisa ser registrado DEPOIS de /latest — senão /latest é engolido como id="latest".
assessmentsRouter.get('/latest', async (req, res) => {
  const businessId = typeof req.query.businessId === 'string' ? req.query.businessId : ''
  if (businessId === '') {
    res.status(400).json({ error: 'businessId query param is required' })
    return
  }

  const [row] = await db
    .select()
    .from(assessments)
    .where(eq(assessments.businessId, businessId))
    .orderBy(desc(assessments.createdAt))
    .limit(1)

  if (!row) {
    res.status(404).json({ error: 'no assessment found for this business' })
    return
  }

  // Todos os seis campos derivados (noi/dscrTarget/monthlyNewDebtCapacity/
  // exceedsMicroloanCeiling/marginSanityTriggered/sectorFound) são persistidos no
  // POST — lidos aqui, nunca recalculados via runAssessment. Fecha o Gap 1 de vez:
  // uma leitura de um assessment antigo reflete o que foi calculado quando ele foi
  // criado, mesmo que a fórmula mude depois. Linhas criadas antes desta migração
  // (nenhuma em produção) terão essas colunas null.
  res.status(200).json({
    id: row.id,
    businessId: row.businessId,
    sectorSegment: row.sectorSegment,
    status: row.status,
    currency: row.currency,
    requestedAmount: row.requestedAmount,
    recommendedAmount: row.recommendedAmount,
    confidenceLevel: row.confidenceLevel,
    score: row.score,
    exceedsMicroloanCeiling: row.exceedsMicroloanCeiling,
    marginSanityTriggered: row.marginSanityTriggered,
    sectorFound: row.sectorFound,
    noi: toNullableNumber(row.noi),
    dscrTarget: toNullableNumber(row.dscrTarget),
    monthlyNewDebtCapacity: toNullableNumber(row.monthlyNewDebtCapacity),
  })
})

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
      // Persistidos aqui pra fechar o Gap 1 de vez — GET /latest lê estas colunas
      // em vez de recalcular via runAssessment.
      noi: result.noi.toString(),
      dscrTarget: result.dscrTarget.toString(),
      monthlyNewDebtCapacity: result.monthlyNewDebtCapacity.toString(),
      exceedsMicroloanCeiling: result.exceedsMicroloanCeiling,
      marginSanityTriggered: result.marginSanityTriggered,
      sectorFound: result.sectorFound,
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
    noi: result.noi,
    dscrTarget: result.dscrTarget,
    monthlyNewDebtCapacity: result.monthlyNewDebtCapacity,
  })
})
