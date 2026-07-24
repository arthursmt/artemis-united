// Único ponto do apps/api que fala com o bob-engine. Injeta o header de auth interna
// (decisão #8, docs/architecture.md §1.4) — apps/web nunca vê este módulo nem o segredo.

export interface MonthlyFinancials {
  revenue: number
  directCosts: number
  operatingExpenses: number
  currentDebtService: number
  personalExtraIncome: number
  personalExpenses: number
}

export interface AssessmentView {
  id: string
  businessId: string
  sectorSegment: string
  status: string
  currency: string
  requestedAmount: string | null
  recommendedAmount: string | null
  confidenceLevel: string | null
  score: string | null
  exceedsMicroloanCeiling: boolean
  marginSanityTriggered: boolean
  recommendationLimiter: 'dscr' | 'revenue_multiple' | 'microloan_ceiling' | null
  sectorFound: boolean
  noi: number
  dscrTarget: number
  monthlyNewDebtCapacity: number
}

function baseUrl(): string {
  return process.env.BOB_ENGINE_URL ?? 'http://localhost:4100'
}

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Internal-Secret': process.env.INTERNAL_SECRET ?? '',
  }
}

export async function createAssessment(payload: {
  businessId: string
  sectorSegment: string
  monthly: MonthlyFinancials
}): Promise<AssessmentView> {
  const response = await fetch(`${baseUrl()}/v1/assessments`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(`bob-engine POST /v1/assessments failed with status ${response.status}`)
  }
  return (await response.json()) as AssessmentView
}

export async function fetchLatestAssessment(businessId: string): Promise<AssessmentView | 'not_found'> {
  const response = await fetch(
    `${baseUrl()}/v1/assessments/latest?businessId=${encodeURIComponent(businessId)}`,
    { headers: headers() },
  )
  if (response.status === 404) {
    return 'not_found'
  }
  if (!response.ok) {
    throw new Error(`bob-engine GET /v1/assessments/latest failed with status ${response.status}`)
  }
  return (await response.json()) as AssessmentView
}
