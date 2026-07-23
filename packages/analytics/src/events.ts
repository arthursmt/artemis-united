import type { SectorSegmentOrOutro } from '@artemis-united/shared-types'

// Regra para qualquer sessão futura de Code adicionando um evento novo: nenhuma
// propriedade pode ser `string`/`number` livre. Isso não é mais só uma
// convenção documentada — é reforçado pelos tipos abaixo (decisão #36 do plano
// mestre): valor financeiro exato nunca compila (usar `MoneyBracket`), campo de
// identidade (nome, email, telefone, endereço) não existe como chave válida em
// nenhum evento, e referência a usuário/negócio usa `InternalId` (branded type),
// nunca `string` livre — não dá pra passar um email no lugar de um ID por
// engano, o tipo não aceita. Se uma propriedade nova parecer PII ou dinheiro
// exato, é sinal de que o evento está desenhado errado; ver `track.ts` para a
// checagem de excesso de propriedades (nem `Exact` nem literal escapam disso).

// Branded type — nunca aceita `string` livre onde um ID interno é esperado.
// `toInternalId` é a única forma de produzir um valor desse tipo: não valida
// nada (o ID já vem de uma linha real do banco), só marca nominalmente que essa
// string passou por um ponto consciente de "isto é um ID interno, não um dado
// de identidade" — um email/nome/telefone atribuído direto não compila.
export type InternalId = string & { readonly __brand: 'InternalId' }
export function toInternalId(id: string): InternalId {
  return id as InternalId
}

// Faixas alinhadas ao teto do produto de referência (SBA Microloan, teto de
// $50k — ver services/bob-engine/src/domain/assessment.ts MICROLOAN_CEILING).
// Nunca um valor monetário exato: a faixa É o tipo, não uma anotação de
// revisão manual.
export type MoneyBracket = '0-4999' | '5000-14999' | '15000-29999' | '30000-49999' | '50000+'
export function toMoneyBracket(amount: number): MoneyBracket {
  if (amount < 5000) return '0-4999'
  if (amount < 15000) return '5000-14999'
  if (amount < 30000) return '15000-29999'
  if (amount < 50000) return '30000-49999'
  return '50000+'
}

// Mesma lógica de faixa pro tempo gasto num bloco do DRE antes de abandonar —
// um "45.231s" exato não agrega nada pra analytics de produto e não precisa
// dessa granularidade.
export type TimeSpentBracket = '0-10' | '11-30' | '31-60' | '61-180' | '181-600' | '600+'
export function toTimeSpentBracket(seconds: number): TimeSpentBracket {
  if (seconds <= 10) return '0-10'
  if (seconds <= 30) return '11-30'
  if (seconds <= 60) return '31-60'
  if (seconds <= 180) return '61-180'
  if (seconds <= 600) return '181-600'
  return '600+'
}

export type SignupStep = 'personal_info' | 'business_info' | 'password'

export type DreBlock =
  | 'revenue'
  | 'direct_costs'
  | 'operating_expenses'
  | 'business_debt'
  | 'personal_income'
  | 'personal_expenses'

// Duplicado de services/bob-engine/src/domain/assessment.ts (ConfidenceLevel) —
// mesmo padrão de duplicação já aceito pra sectors.ts/labels: dado de
// underwriting não é importado aqui, só o formato de 3 níveis é reaproveitado.
export type ConfidenceLevel = 'low' | 'medium' | 'high'

// Categoria de produto pra analytics — nunca o nome real da instituição
// (`institution_name` em app.institution_connections é texto livre e nunca
// deve chegar aqui; é granular/identificável demais pra evento de analytics).
export type InstitutionCategory = 'traditional_bank' | 'credit_union' | 'online_bank' | 'fintech_lender' | 'other'

// As 8 jornadas da Seção 4 do plano mestre (4.1–4.8).
export type Journey =
  | 'signup'
  | 'login'
  | 'onboarding_cliente'
  | 'onboarding_negocio'
  | 'dre'
  | 'dashboard_chat_bob'
  | 'configuracoes'
  | 'conectar_instituicoes'

export type ErrorType = 'network' | 'validation' | 'unauthorized' | 'server_error' | 'unknown'

export type AnalyticsEvent =
  | { name: 'signup_step_completed'; properties: { step: SignupStep; step_index: 0 | 1 | 2 } }
  | { name: 'dre_block_completed'; properties: { block: DreBlock; block_index: 0 | 1 | 2 | 3 | 4 | 5 } }
  | {
      name: 'dre_block_abandoned'
      properties: { block: DreBlock; block_index: 0 | 1 | 2 | 3 | 4 | 5; time_spent_bracket: TimeSpentBracket }
    }
  | {
      name: 'assessment_completed'
      properties: {
        confidence_level: ConfidenceLevel
        sector_segment: SectorSegmentOrOutro
        recommended_amount_bracket: MoneyBracket
      }
    }
  | {
      name: 'bob_chat_interaction'
      properties: { category: 'recommendation_question' | 'simulation_request' | 'general_question' }
    }
  | {
      name: 'institution_connection_result'
      properties: { status: 'success' | 'error' | 'pending'; institution_category: InstitutionCategory }
    }
  | { name: 'recommendation_clicked'; properties: { institution_category: InstitutionCategory } }
  | { name: 'two_factor_enabled'; properties: Record<never, never> }
  | { name: 'error_occurred'; properties: { journey: Journey; error_type: ErrorType } }
