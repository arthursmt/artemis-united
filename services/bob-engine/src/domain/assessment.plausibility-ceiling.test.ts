import { describe, expect, it } from 'vitest'
import { runAssessment, type MonthlyFinancials } from './assessment.js'

// Fase 4 do reforço de QA: mesmo com o NOI usando o Saldo Consolidado (fix
// anterior, ver assessment.test.ts), cenários com custo/dívida perto de
// zero ainda geravam recomendação implausível — DSCR sozinho não tem
// limitador por escala de receita. Este arquivo cobre a segunda camada de
// limitação: MENOR entre (a) DSCR-alvo, (b) múltiplo de receita mensal
// (REVENUE_MULTIPLIER_CAP, ponto de partida 2x — não decisão fechada), (c)
// teto absoluto do SBA Microloan (US$50.000).
describe('runAssessment — teto de plausibilidade por múltiplo de receita e microloan', () => {
  it('cenário original do bug (revenue=$6k, custos mínimos): teto de receita vence, ≤ 2x a receita e ≤ US$50k', () => {
    const result = runAssessment('restaurante_full_service', {
      revenue: 6000,
      directCosts: 2000,
      operatingExpenses: 1500,
      currentDebtService: 200,
      personalExtraIncome: 0,
      personalExpenses: 1500,
    })

    expect(result.recommendedAmount).toBeLessThanOrEqual(12_000) // 2x $6.000
    expect(result.recommendedAmount).toBeLessThanOrEqual(50_000)
    expect(result.recommendationLimiter).toBe('revenue_multiple')
    // DSCR sozinho (sem os tetos) não excedia o teto do microloan neste
    // cenário — quem limitou foi o múltiplo de receita, não o microloan.
    expect(result.exceedsMicroloanCeiling).toBe(false)
  })

  it('receita alta com capacidade de dívida moderada: DSCR continua sendo o limitador, tetos não interferem', () => {
    const result = runAssessment('restaurante_full_service', {
      revenue: 50_000,
      directCosts: 30_000,
      operatingExpenses: 15_000,
      currentDebtService: 1_400,
      personalExtraIncome: 0,
      personalExpenses: 2_000,
    })

    expect(result.recommendationLimiter).toBe('dscr')
    expect(result.recommendedAmount).toBeLessThan(50_000) // não bateu no teto do microloan
    expect(result.recommendedAmount).toBeLessThan(50_000 * 2) // nem no de receita
    expect(result.exceedsMicroloanCeiling).toBe(false)
  })

  it('receita alta com folga grande de caixa: DSCR pede mais que o microloan cobre — exceedsMicroloanCeiling dispara e o teto (c) assume', () => {
    const result = runAssessment('restaurante_full_service', {
      revenue: 50_000,
      directCosts: 15_000,
      operatingExpenses: 10_000,
      currentDebtService: 500,
      personalExtraIncome: 0,
      personalExpenses: 2_000,
    })

    // DSCR sozinho pediria muito mais que US$50k (negócio com folga grande);
    // o teto de microloan é quem efetivamente limita aqui, não o de receita
    // (2x $50.000 = $100.000, bem acima do teto absoluto).
    expect(result.exceedsMicroloanCeiling).toBe(true)
    expect(result.recommendationLimiter).toBe('microloan_ceiling')
    expect(result.recommendedAmount).toBe(50_000)
  })

  it('fronteira: DSCR levemente ACIMA do teto de receita — revenue_multiple vence por pouco', () => {
    const result = runAssessment('restaurante_full_service', {
      revenue: 10_000,
      directCosts: 9_417,
      operatingExpenses: 0,
      currentDebtService: 0,
      personalExtraIncome: 0,
      personalExpenses: 0,
    })

    expect(result.recommendationLimiter).toBe('revenue_multiple')
    expect(result.recommendedAmount).toBe(20_000) // 2x $10.000
  })

  it('fronteira: DSCR levemente ABAIXO do teto de receita — dscr vence por pouco', () => {
    const result = runAssessment('restaurante_full_service', {
      revenue: 10_000,
      directCosts: 9_423,
      operatingExpenses: 0,
      currentDebtService: 0,
      personalExtraIncome: 0,
      personalExpenses: 0,
    })

    expect(result.recommendationLimiter).toBe('dscr')
    expect(result.recommendedAmount).toBeLessThan(20_000)
  })

  it('confidence_level desce um degrau quando um teto de plausibilidade é o limitador ativo', () => {
    const baseInput: MonthlyFinancials = {
      revenue: 6000,
      directCosts: 2000,
      operatingExpenses: 1500,
      currentDebtService: 200,
      personalExtraIncome: 0,
      personalExpenses: 1500,
    }

    // setor 'padaria' (confidenceTier padrao -> medium na ausência de outro
    // gatilho) usado para isolar o efeito do teto do efeito do sanity-check
    // de margem (que já teria seu próprio teste em assessment.test.ts).
    const capped = runAssessment('padaria', baseInput)
    expect(capped.recommendationLimiter).not.toBe('dscr')
    expect(capped.marginSanityTriggered).toBe(false)
    expect(capped.confidenceLevel).toBe('low') // medium -> low, um degrau

    const notCapped = runAssessment('padaria', {
      ...baseInput,
      revenue: 50_000,
      directCosts: 30_000,
      operatingExpenses: 15_000,
      currentDebtService: 1_400,
      personalExpenses: 2_000,
    })
    expect(notCapped.recommendationLimiter).toBe('dscr')
    expect(notCapped.confidenceLevel).toBe('medium') // sem downgrade
  })

  it('não fica redundante/conflitante com exceedsMicroloanCeiling: exceedsMicroloanCeiling mede o valor SEM os tetos', () => {
    // Mesmo cenário do teste de fronteira "revenue_multiple vence" acima:
    // o teto que agiu foi o de RECEITA, não o de microloan — dscrAmount
    // aqui nem chega a exceder US$50k, então exceedsMicroloanCeiling deve
    // ser false mesmo com um teto tendo entrado em ação.
    const result = runAssessment('restaurante_full_service', {
      revenue: 10_000,
      directCosts: 9_417,
      operatingExpenses: 0,
      currentDebtService: 0,
      personalExtraIncome: 0,
      personalExpenses: 0,
    })

    expect(result.recommendationLimiter).toBe('revenue_multiple')
    expect(result.exceedsMicroloanCeiling).toBe(false)
  })
})
