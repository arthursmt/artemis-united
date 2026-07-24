import { describe, expect, it } from 'vitest'
import { runAssessment, type MonthlyFinancials } from './assessment.js'

// Caso reportado em teste manual (QA): faturamento de $6k/mês aprovando
// recomendação de ~$76,8k (chegando a $120k em variações do mesmo teste) —
// implausível para o porte do negócio. Causa raiz: NOI ignorava
// personalExtraIncome/personalExpenses, calculando a capacidade de dívida só
// a partir do resultado do negócio, não do Saldo Consolidado (negócio +
// pessoal) exigido pela Seção 3 do documento de parâmetros setoriais e pela
// definição de Saldo Consolidado do plano mestre §4.5.
describe('runAssessment — NOI usa o Saldo Consolidado (negócio + pessoal)', () => {
  const baseInput: MonthlyFinancials = {
    revenue: 6000,
    directCosts: 2000,
    operatingExpenses: 1500,
    currentDebtService: 200,
    personalExtraIncome: 0,
    personalExpenses: 1500,
  }

  it('reduz o NOI pelo saldo pessoal negativo, em vez de considerar só o negócio', () => {
    const result = runAssessment('restaurante_full_service', baseInput)

    // businessResult sozinho seria 2500 (6000-2000-1500) — o bug antigo
    // reportava NOI=2500, ignorando a despesa pessoal. NOI correto:
    // 2500 (negócio) + (0 - 1500) (saldo pessoal) = 1000.
    expect(result.noi).toBeCloseTo(1000, 2)
  })

  it('não recomenda um valor implausível em relação ao faturamento', () => {
    const result = runAssessment('restaurante_full_service', baseInput)

    // Antes da correção, este cenário recomendava ~US$76.852 (quase 13x o
    // faturamento mensal) e excedia o teto do microloan de referência.
    // Com o saldo pessoal considerado, o valor cai para uma faixa plausível.
    expect(result.recommendedAmount).toBeLessThan(30_000)
    expect(result.exceedsMicroloanCeiling).toBe(false)
  })

  it('renda pessoal extra aumenta a capacidade; despesa pessoal reduz', () => {
    const withExtraIncome = runAssessment('restaurante_full_service', {
      ...baseInput,
      personalExtraIncome: 1500,
      personalExpenses: 0,
    })
    const withOnlyExpenses = runAssessment('restaurante_full_service', {
      ...baseInput,
      personalExtraIncome: 0,
      personalExpenses: 1500,
    })

    expect(withExtraIncome.noi).toBeGreaterThan(withOnlyExpenses.noi)
    expect(withExtraIncome.monthlyNewDebtCapacity).toBeGreaterThan(withOnlyExpenses.monthlyNewDebtCapacity)
  })

  it('setor não encontrado usa o fallback (DSCR base, confiança low), sem inventar parâmetro', () => {
    const result = runAssessment('setor-inexistente', baseInput)

    expect(result.sectorFound).toBe(false)
    expect(result.dscrTarget).toBeCloseTo(1.25, 5)
    expect(result.confidenceLevel).toBe('low')
  })
})
