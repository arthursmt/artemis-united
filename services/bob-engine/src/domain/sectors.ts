// Fonte: docs/bob-engine-parametros-setoriais.md, Seção 5 (faixas de margem líquida),
// Seção 4.3 + 4.1 (risco por setor, revisado e fechado com o fundador — ver Seção 9),
// Seção 7 ponto 6 (regra de confidence_level por qualidade de fonte).
//
// 14 subseções (5.1–5.14) da Seção 5 — o documento fala em "13 setores prioritários"
// como contagem aproximada; aqui cada subseção vira um segmento próprio porque a
// classificação de risco (revisada) já trata full-service e quick-service como
// itens distintos.
//
// slug + label vêm de @artemis-united/shared-types (fonte única, mesmo padrão de
// apps/api) — risco/confiança/margem são dado de underwriting e continuam só aqui,
// não fazem sentido fora do domínio do bob-engine.

import { SECTOR_SEGMENT_OPTIONS, type SectorSegment } from '@artemis-united/shared-types'

export type SectorRiskTier = 'alto' | 'padrao'
export type SectorConfidenceTier = 'forte' | 'padrao' | 'fraca'

export interface SectorProfile {
  slug: SectorSegment
  label: string
  riskTier: SectorRiskTier
  confidenceTier: SectorConfidenceTier
  // Faixa de margem líquida (fração, não %) extraída da Seção 5 — usada só para o
  // sanity-check da Seção 7 ponto 1. Outliers pontuais citados na fonte (ex: 43% em
  // salão de unhas, 40%+ em creche) são deliberadamente excluídos da faixa.
  netMarginRange: readonly [number, number]
}

interface SectorUnderwritingData {
  riskTier: SectorRiskTier
  confidenceTier: SectorConfidenceTier
  netMarginRange: readonly [number, number]
}

const UNDERWRITING_DATA: Record<SectorSegment, SectorUnderwritingData> = {
  restaurante_full_service: { riskTier: 'alto', confidenceTier: 'padrao', netMarginRange: [0.03, 0.09] },
  restaurante_quick_service: { riskTier: 'alto', confidenceTier: 'padrao', netMarginRange: [0.04, 0.12] },
  padaria: { riskTier: 'padrao', confidenceTier: 'padrao', netMarginRange: [0.05, 0.15] },
  barbearia: { riskTier: 'alto', confidenceTier: 'padrao', netMarginRange: [0.08, 0.2] },
  salao_beleza: { riskTier: 'alto', confidenceTier: 'padrao', netMarginRange: [0.02, 0.15] },
  loja_conveniencia: {
    riskTier: 'alto',
    confidenceTier: 'padrao',
    // Combina conveniência (~5-10%) e mercearia independente (1-3%) — categoria
    // única na fonte (5.6), banda ampliada para cobrir ambos os subtipos.
    netMarginRange: [0.01, 0.1],
  },
  limpeza: { riskTier: 'padrao', confidenceTier: 'padrao', netMarginRange: [0.1, 0.28] },
  construcao: {
    riskTier: 'alto',
    confidenceTier: 'forte', // NAHB citada como a fonte mais rigorosa deste grupo
    netMarginRange: [0.05, 0.12],
  },
  paisagismo: { riskTier: 'padrao', confidenceTier: 'padrao', netMarginRange: [0.1, 0.4] },
  food_truck: { riskTier: 'padrao', confidenceTier: 'padrao', netMarginRange: [0.06, 0.15] },
  oficina_mecanica: { riskTier: 'padrao', confidenceTier: 'padrao', netMarginRange: [0.06, 0.2] },
  salao_unhas: { riskTier: 'alto', confidenceTier: 'padrao', netMarginRange: [0.15, 0.4] },
  creche: {
    riskTier: 'padrao',
    confidenceTier: 'fraca', // fonte de triangulação fraca — Seção 7.6
    netMarginRange: [0.05, 0.25],
  },
  lavanderia: {
    riskTier: 'padrao',
    confidenceTier: 'fraca', // fonte de triangulação fraca — Seção 7.6
    netMarginRange: [0.25, 0.35],
  },
}

export const SECTORS: readonly SectorProfile[] = SECTOR_SEGMENT_OPTIONS.map((option) => ({
  slug: option.slug,
  label: option.label,
  ...UNDERWRITING_DATA[option.slug],
}))

const SECTORS_BY_SLUG = new Map<string, SectorProfile>(SECTORS.map((sector) => [sector.slug, sector]))

// Setor fora dos 14 documentados (ver Seção 6 do documento de parâmetros) — regra
// de fallback da Seção 1: calcular sem parâmetro de segmentação, nunca inventar
// um número. Tratado com o mesmo patamar de confiança da fonte fraca (Seção 7.6).
// Parâmetro fica string solto (não SectorSegment) de propósito: precisa aceitar
// qualquer valor vindo do payload da API para ativar esse fallback.
export function findSector(slug: string): SectorProfile | undefined {
  return SECTORS_BY_SLUG.get(slug)
}
