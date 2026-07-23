// Teste de TIPO, não de runtime (decisão #36 do plano mestre) — nenhuma dessas
// chamadas roda de verdade (não é importado por ninguém), só existe pra `tsc`
// provar as garantias abaixo em tempo de compilação. `noUnusedLocals` está
// ligado no tsconfig base, então toda const declarada precisa ser referenciada
// (via `track(...)` ou `void`).

import { toInternalId, toMoneyBracket, toTimeSpentBracket, track, type InternalId } from './index'

// --- Casos positivos: precisam compilar sem erro (prova que não quebramos o caminho válido) ---

track('signup_step_completed', { step: 'personal_info', step_index: 0 })
track('two_factor_enabled', {})
track('assessment_completed', {
  confidence_level: 'medium',
  sector_segment: 'padaria',
  recommended_amount_bracket: toMoneyBracket(24_000),
})
track('dre_block_abandoned', {
  block: 'revenue',
  block_index: 0,
  time_spent_bracket: toTimeSpentBracket(45),
})

const validId: InternalId = toInternalId('c285963f-b49e-426b-9f38-46d079c7dc3a')
void validId

// --- Critério 1: nenhum campo pode ser string/number livre — literal fora da união não compila ---

// @ts-expect-error — 'not_a_real_step' não é um SignupStep válido
track('signup_step_completed', { step: 'not_a_real_step', step_index: 0 })

// @ts-expect-error — block_index só aceita 0-5, não 6
track('dre_block_completed', { block: 'revenue', block_index: 6 })

// --- Critério 2: campo monetário não aceita number exato, só MoneyBracket ---

// @ts-expect-error — 25000 é um number exato, não um MoneyBracket
track('assessment_completed', {
  confidence_level: 'high',
  sector_segment: 'padaria',
  recommended_amount_bracket: 25000,
})

// --- Critério 3: InternalId é um branded type — string livre não é atribuível sem passar por toInternalId ---

// @ts-expect-error — string livre (poderia ser um email) não é um InternalId
const idFromRawString: InternalId = 'user@example.com'
void idFromRawString

// --- Critério 4: track() rejeita propriedade a mais mesmo passando por uma variável (não só literal direto) ---

const stepPropsWithExtraField = { step: 'personal_info', step_index: 0, leaked_field: 'oops' } as const
// @ts-expect-error — leaked_field não existe no shape de signup_step_completed, mesmo vindo de uma variável
track('signup_step_completed', stepPropsWithExtraField)

// Propriedades de um evento não podem ser usadas para outro (mistura de shapes)
const wrongShapeForName = { step: 'personal_info', step_index: 0 } as const
// @ts-expect-error — essas properties pertencem a signup_step_completed, não a two_factor_enabled
track('two_factor_enabled', wrongShapeForName)

// Campo obrigatório faltando também precisa falhar (mesmo mecanismo de `extends`, não só o Exact)
// @ts-expect-error — sector_segment e recommended_amount_bracket estão faltando
track('assessment_completed', { confidence_level: 'low' })
