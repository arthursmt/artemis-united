// Fonte: docs/bob-engine-parametros-setoriais.md, Seção 5 (faixas de margem líquida),
// Seção 4.3 + 4.1 (risco por setor, revisado e fechado com o fundador — ver Seção 9),
// Seção 7 ponto 6 (regra de confidence_level por qualidade de fonte).
//
// 14 subseções (5.1–5.14) da Seção 5 — o documento fala em "13 setores prioritários"
// como contagem aproximada; aqui cada subseção vira um segmento próprio porque a
// classificação de risco (revisada) já trata full-service e quick-service como
// itens distintos.

export type SectorRiskTier = 'alto' | 'padrao'
export type SectorConfidenceTier = 'forte' | 'padrao' | 'fraca'

export interface SectorProfile {
  slug: string
  label: string
  riskTier: SectorRiskTier
  confidenceTier: SectorConfidenceTier
  // Faixa de margem líquida (fração, não %) extraída da Seção 5 — usada só para o
  // sanity-check da Seção 7 ponto 1. Outliers pontuais citados na fonte (ex: 43% em
  // salão de unhas, 40%+ em creche) são deliberadamente excluídos da faixa.
  netMarginRange: readonly [number, number]
}

export const SECTORS: readonly SectorProfile[] = [
  {
    slug: 'restaurante_full_service',
    label: 'Restaurante — serviço completo',
    riskTier: 'alto',
    confidenceTier: 'padrao',
    netMarginRange: [0.03, 0.09],
  },
  {
    slug: 'restaurante_quick_service',
    label: 'Restaurante — quick-service / fast-casual',
    riskTier: 'alto',
    confidenceTier: 'padrao',
    netMarginRange: [0.04, 0.12],
  },
  {
    slug: 'padaria',
    label: 'Padaria',
    riskTier: 'padrao',
    confidenceTier: 'padrao',
    netMarginRange: [0.05, 0.15],
  },
  {
    slug: 'barbearia',
    label: 'Barbearia',
    riskTier: 'alto',
    confidenceTier: 'padrao',
    netMarginRange: [0.08, 0.2],
  },
  {
    slug: 'salao_beleza',
    label: 'Salão de cabelo / beleza',
    riskTier: 'alto',
    confidenceTier: 'padrao',
    netMarginRange: [0.02, 0.15],
  },
  {
    slug: 'loja_conveniencia',
    label: 'Loja de conveniência / mercearia de bairro / bodega',
    riskTier: 'alto',
    confidenceTier: 'padrao',
    // Combina conveniência (~5-10%) e mercearia independente (1-3%) — categoria
    // única na fonte (5.6), banda ampliada para cobrir ambos os subtipos.
    netMarginRange: [0.01, 0.1],
  },
  {
    slug: 'limpeza',
    label: 'Limpeza (residencial e comercial)',
    riskTier: 'padrao',
    confidenceTier: 'padrao',
    netMarginRange: [0.1, 0.28],
  },
  {
    slug: 'construcao',
    label: 'Construção / reforma residencial',
    riskTier: 'alto',
    confidenceTier: 'forte', // NAHB citada como a fonte mais rigorosa deste grupo
    netMarginRange: [0.05, 0.12],
  },
  {
    slug: 'paisagismo',
    label: 'Paisagismo / jardinagem',
    riskTier: 'padrao',
    confidenceTier: 'padrao',
    netMarginRange: [0.1, 0.4],
  },
  {
    slug: 'food_truck',
    label: 'Food truck',
    riskTier: 'padrao',
    confidenceTier: 'padrao',
    netMarginRange: [0.06, 0.15],
  },
  {
    slug: 'oficina_mecanica',
    label: 'Oficina mecânica (auto repair)',
    riskTier: 'padrao',
    confidenceTier: 'padrao',
    netMarginRange: [0.06, 0.2],
  },
  {
    slug: 'salao_unhas',
    label: 'Salão de unhas (nail salon)',
    riskTier: 'alto',
    confidenceTier: 'padrao',
    netMarginRange: [0.15, 0.4],
  },
  {
    slug: 'creche',
    label: 'Creche / cuidado infantil',
    riskTier: 'padrao',
    confidenceTier: 'fraca', // fonte de triangulação fraca — Seção 7.6
    netMarginRange: [0.05, 0.25],
  },
  {
    slug: 'lavanderia',
    label: 'Lavanderia self-service',
    riskTier: 'padrao',
    confidenceTier: 'fraca', // fonte de triangulação fraca — Seção 7.6
    netMarginRange: [0.25, 0.35],
  },
] as const

const SECTORS_BY_SLUG = new Map(SECTORS.map((sector) => [sector.slug, sector]))

// Setor fora dos 14 documentados (ver Seção 6 do documento de parâmetros) — regra
// de fallback da Seção 1: calcular sem parâmetro de segmentação, nunca inventar
// um número. Tratado com o mesmo patamar de confiança da fonte fraca (Seção 7.6).
export function findSector(slug: string): SectorProfile | undefined {
  return SECTORS_BY_SLUG.get(slug)
}
