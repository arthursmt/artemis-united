// Fonte única dos 14 setores prioritários do ICP — usada tanto por apps/api (validação na
// criação de negócio) quanto por services/bob-engine (services/bob-engine/src/domain/sectors.ts
// importa o tipo SectorSegment daqui). Labels copiados de lá; dados de risco/confiança/margem
// (underwriting) continuam vivendo só em bob-engine, não duplicados aqui.
export const SECTOR_SEGMENT_OPTIONS = [
  { slug: 'restaurante_full_service', label: 'Restaurante — serviço completo' },
  { slug: 'restaurante_quick_service', label: 'Restaurante — quick-service / fast-casual' },
  { slug: 'padaria', label: 'Padaria' },
  { slug: 'barbearia', label: 'Barbearia' },
  { slug: 'salao_beleza', label: 'Salão de cabelo / beleza' },
  { slug: 'loja_conveniencia', label: 'Loja de conveniência / mercearia de bairro / bodega' },
  { slug: 'limpeza', label: 'Limpeza (residencial e comercial)' },
  { slug: 'construcao', label: 'Construção / reforma residencial' },
  { slug: 'paisagismo', label: 'Paisagismo / jardinagem' },
  { slug: 'food_truck', label: 'Food truck' },
  { slug: 'oficina_mecanica', label: 'Oficina mecânica (auto repair)' },
  { slug: 'salao_unhas', label: 'Salão de unhas (nail salon)' },
  { slug: 'creche', label: 'Creche / cuidado infantil' },
  { slug: 'lavanderia', label: 'Lavanderia self-service' },
] as const

export type SectorSegment = (typeof SECTOR_SEGMENT_OPTIONS)[number]['slug']
export const SECTOR_SEGMENTS: readonly SectorSegment[] = SECTOR_SEGMENT_OPTIONS.map((o) => o.slug)

// Setor fora dos 14 documentados — mesma regra de fallback do bob-engine
// (services/bob-engine/src/domain/sectors.ts).
export const OUTRO_SEGMENT = 'outro' as const
export type SectorSegmentOrOutro = SectorSegment | typeof OUTRO_SEGMENT
