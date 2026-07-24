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

// Teto de plausibilidade por múltiplo de receita mensal — segunda camada de
// limitação da capacidade de dívida, POR CIMA do resultado do DSCR-alvo
// (Seção 3, fórmula não alterada). Existe porque DSCR sozinho não tem
// limitador por escala de receita: um negócio com custo/dívida perto de
// zero pode passar num DSCR-alvo baixo e ainda assim gerar uma
// recomendação de vários múltiplos do próprio faturamento — nenhum credor
// real usa DSCR como único limitador (ver Fase 4 do reforço de QA desta
// sessão, achado no cenário revenue=$6.000/mês).
//
// Valor de 2x CONFIRMADO pelo fundador (ver Log de decisões do plano
// mestre) — permanece parametrizado (não hardcoded inline) para facilitar
// recalibração futura com dado real de uso, não porque o valor em si esteja
// em aberto. Faixa de mercado usada como referência (benchmark de credores
// reais dos EUA, 2026):
//   - Empréstimo a prazo (term loan): 1x – 2x a receita bruta mensal
//   - Linha de crédito: 10% – 30% da receita mensal
//   - MCA: exige piso de ~US$10.000–15.000/mês de receita para elegibilidade
//   - SBA Microloan: teto de US$50.000; média nacional real de US$16.131 (FY2025)
// 2x é o limite SUPERIOR da faixa de term loan (a mais generosa das quatro).
export const REVENUE_MULTIPLIER_CAP = 2

export type RecommendationLimiter = 'dscr' | 'revenue_multiple' | 'microloan_ceiling'

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
  recommendationLimiter: RecommendationLimiter
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
// `downgrades` conta quantos gatilhos independentes de sanity-check dispararam
// (margem fora da faixa do setor — Seção 7 item 1 — e, agora, teto de
// plausibilidade ativo — Fase 4 do reforço de QA) — cada um desce um degrau,
// empilhando se mais de um disparar ao mesmo tempo.
function computeConfidenceLevel(sector: SectorProfile | undefined, downgrades: number): ConfidenceLevel {
  const tier = sector?.confidenceTier ?? 'fraca' // sem sector = fallback, mesmo patamar da fonte fraca
  let level: ConfidenceLevel = tier === 'forte' ? 'high' : tier === 'padrao' ? 'medium' : 'low'

  for (let i = 0; i < downgrades; i++) {
    level = level === 'high' ? 'medium' : 'low'
  }

  return level
}

export function runAssessment(sectorSlug: string, monthly: MonthlyFinancials): AssessmentResult {
  const sector = findSector(sectorSlug)

  // NOI vem do Saldo Consolidado (negócio + pessoal), não só do resultado do
  // negócio — decisão fechada na Seção 3 do documento de parâmetros
  // setoriais e na definição de "Saldo Consolidado" do plano mestre §4.5.
  // Bug encontrado em teste manual: personalExtraIncome/personalExpenses
  // eram coletados, validados e persistidos, mas nunca entravam nesta conta
  // — capacidade de dívida ficava superestimada por ignorar o saldo pessoal
  // negativo (ex: aluguel/alimentação da família).
  const businessResult = monthly.revenue - monthly.directCosts - monthly.operatingExpenses
  const personalBalance = monthly.personalExtraIncome - monthly.personalExpenses
  const noi = businessResult + personalBalance
  const dscrTarget = computeDscrTarget(sector)
  const monthlyNewDebtCapacity = noi / dscrTarget - monthly.currentDebtService

  // Capacidade via DSCR-alvo (fórmula da Seção 3, não alterada aqui) é o
  // ponto de partida — mas sozinha não tem limitador por escala de receita.
  // A recomendação final é o MENOR entre os três: (a) DSCR, (b) múltiplo de
  // receita mensal (novo, ver REVENUE_MULTIPLIER_CAP acima), (c) teto
  // absoluto do produto de crédito mais realista pro ICP (SBA Microloan).
  // `exceedsMicroloanCeiling` mede o valor (a) SEM os tetos, de propósito —
  // ver comentário abaixo, perto de onde é calculado.
  const dscrAmount = monthlyCapacityToPrincipal(monthlyNewDebtCapacity)
  const revenueMultipleAmount = monthly.revenue * REVENUE_MULTIPLIER_CAP
  const microloanCeilingAmount = MICROLOAN_CEILING

  let recommendedAmount = dscrAmount
  let recommendationLimiter: RecommendationLimiter = 'dscr'
  if (revenueMultipleAmount < recommendedAmount) {
    recommendedAmount = revenueMultipleAmount
    recommendationLimiter = 'revenue_multiple'
  }
  if (microloanCeilingAmount < recommendedAmount) {
    recommendedAmount = microloanCeilingAmount
    recommendationLimiter = 'microloan_ceiling'
  }

  // Continua medindo o valor (a) SEM nenhum teto aplicado — não
  // `recommendedAmount > MICROLOAN_CEILING`, que depois do teto (c) acima
  // nunca mais seria verdadeiro (recommendedAmount passa a ser sempre
  // <= MICROLOAN_CEILING por construção). Preserva o sentido original do
  // sinal ("o DSCR sozinho pediria mais do que um microloan cobre") sem
  // ficar redundante com `recommendationLimiter === 'microloan_ceiling'`:
  // quando este flag é true, um dos dois tetos necessariamente entrou em
  // ação (dscrAmount > MICROLOAN_CEILING implica microloanCeilingAmount <
  // recommendedAmount original, então o min() abaixo dele nunca deixa
  // passar); quando é false, nenhum teto precisava agir por causa do DSCR.
  const exceedsMicroloanCeiling = dscrAmount > MICROLOAN_CEILING

  const margin = monthly.revenue !== 0 ? noi / monthly.revenue : 0
  const marginSanityTriggered = sector
    ? marginDistanceFromRange(margin, sector.netMarginRange) > MARGIN_SANITY_THRESHOLD_PP
    : false // sem parâmetro de setor, não há faixa para comparar — regra de fallback

  // Mesmo padrão do sanity-check de margem (Seção 7 item 6): quando um teto
  // de plausibilidade novo (revenue_multiple ou microloan_ceiling) é o
  // limitador ativo, a confiança desce um degrau — o DSCR sozinho "queria"
  // recomendar mais do que o teto permitiu, sinal de que o número final é
  // menos direto do que o cálculo padrão.
  const capLimiterTriggered = recommendationLimiter !== 'dscr'
  const downgrades = Number(marginSanityTriggered) + Number(capLimiterTriggered)
  const confidenceLevel = computeConfidenceLevel(sector, downgrades)

  return {
    sectorSlug,
    sectorFound: sector !== undefined,
    noi,
    dscrTarget,
    monthlyNewDebtCapacity,
    recommendedAmount,
    recommendationLimiter,
    exceedsMicroloanCeiling,
    marginSanityTriggered,
    confidenceLevel,
  }
}
