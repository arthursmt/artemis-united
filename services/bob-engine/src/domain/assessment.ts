import { findSector, type SectorProfile } from './sectors.js'

// Fórmula fechada com o fundador em duas rodadas (ver docs/bob-engine-parametros-setoriais.md
// Seção 3/4/7, e o handoff da Etapa 3 no histórico do projeto). Pontos citados como
// "minha interpretação" nessa conversa e depois aprovados ficam marcados abaixo.

const DSCR_BASE = 1.25 // SBA 7(a), padrão de mercado — Seção 4.1
const DSCR_HIGH_RISK_ADJUSTMENT = 0.1 // aprovado — setor de alto risco (Eixo A)
const DSCR_MIN = 1.15
const DSCR_MAX = 1.5

// SBA Microloan assumido como produto de referência (Seção 4.4) — taxa e prazo são
// premissa única, fixa, aprovada para a Etapa 3. Não recalcula para outro produto
// se o valor ultrapassar o teto (ver EXCEEDS_MICROLOAN_CEILING abaixo).
const MICROLOAN_ANNUAL_RATE = 0.105 // ponto médio da faixa 8%-13%, Seção 4.2
const MICROLOAN_TERM_MONTHS = 60
const MICROLOAN_CEILING = 50_000 // Seção 4.2

// Gatilho do sanity-check de margem (Seção 7 ponto 1) — distância da faixa do setor,
// em pontos percentuais. Não especificado na fonte, valor proposto e aprovado.
const MARGIN_SANITY_THRESHOLD_PP = 0.1

export interface MonthlyFinancials {
  revenue: number
  directCosts: number
  operatingExpenses: number
  currentDebtService: number
  personalExtraIncome: number
  personalExpenses: number
}

export type ConfidenceLevel = 'low' | 'medium' | 'high'

export interface AssessmentResult {
  sectorSlug: string
  sectorFound: boolean
  noi: number
  dscrTarget: number
  monthlyNewDebtCapacity: number
  recommendedAmount: number
  exceedsMicroloanCeiling: boolean
  marginSanityTriggered: boolean
  confidenceLevel: ConfidenceLevel
}

function computeDscrTarget(sector: SectorProfile | undefined): number {
  const adjustment = sector?.riskTier === 'alto' ? DSCR_HIGH_RISK_ADJUSTMENT : 0
  return clamp(DSCR_BASE + adjustment, DSCR_MIN, DSCR_MAX)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// Anuidade padrão: capacidade mensal de parcela -> principal do empréstimo, dado
// taxa e prazo fixos do produto assumido (SBA Microloan).
function monthlyCapacityToPrincipal(monthlyCapacity: number): number {
  if (monthlyCapacity <= 0) return 0
  const i = MICROLOAN_ANNUAL_RATE / 12
  const n = MICROLOAN_TERM_MONTHS
  const principal = monthlyCapacity * ((1 - (1 + i) ** -n) / i)
  return Math.max(0, principal)
}

// Distância (em pontos percentuais) entre a margem informada e a faixa do setor.
// Zero se a margem já está dentro da faixa.
function marginDistanceFromRange(margin: number, range: readonly [number, number]): number {
  const [min, max] = range
  if (margin < min) return min - margin
  if (margin > max) return margin - max
  return 0
}

// Mapeamento tier qualitativo -> enum do banco (bob.assessment_confidence_level é
// 'low'|'medium'|'high', não uma escala 1-10). A regra qualitativa (forte/padrão/
// fraca + penalidade do sanity-check) foi aprovada nessa forma; a tradução abaixo é
// mecânica: forte->high, padrão->medium, fraca/fallback->low, e o "ajuste -2" da
// proposta original vira "descer um degrau" (high->medium->low, low permanece low).
function computeConfidenceLevel(
  sector: SectorProfile | undefined,
  marginSanityTriggered: boolean,
): ConfidenceLevel {
  const tier = sector?.confidenceTier ?? 'fraca' // sem sector = fallback, mesmo patamar da fonte fraca
  let level: ConfidenceLevel = tier === 'forte' ? 'high' : tier === 'padrao' ? 'medium' : 'low'

  if (marginSanityTriggered) {
    if (level === 'high') level = 'medium'
    else level = 'low'
  }

  return level
}

export function runAssessment(sectorSlug: string, monthly: MonthlyFinancials): AssessmentResult {
  const sector = findSector(sectorSlug)

  const noi = monthly.revenue - monthly.directCosts - monthly.operatingExpenses
  const dscrTarget = computeDscrTarget(sector)
  const monthlyNewDebtCapacity = noi / dscrTarget - monthly.currentDebtService
  const recommendedAmount = monthlyCapacityToPrincipal(monthlyNewDebtCapacity)
  const exceedsMicroloanCeiling = recommendedAmount > MICROLOAN_CEILING

  const margin = monthly.revenue !== 0 ? noi / monthly.revenue : 0
  const marginSanityTriggered = sector
    ? marginDistanceFromRange(margin, sector.netMarginRange) > MARGIN_SANITY_THRESHOLD_PP
    : false // sem parâmetro de setor, não há faixa para comparar — regra de fallback

  const confidenceLevel = computeConfidenceLevel(sector, marginSanityTriggered)

  return {
    sectorSlug,
    sectorFound: sector !== undefined,
    noi,
    dscrTarget,
    monthlyNewDebtCapacity,
    recommendedAmount,
    exceedsMicroloanCeiling,
    marginSanityTriggered,
    confidenceLevel,
  }
}
