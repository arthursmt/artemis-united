// Regra para qualquer sessão futura de Code adicionando um evento novo:
// nunca adicionar um campo de valor financeiro exato (usar faixa/bracket) nem
// campo de PII (nome, email, endereço — usar apenas IDs internos já existentes)
// a uma properties. Se a propriedade parecer PII ou dinheiro exato, é sinal de
// que o evento está desenhado errado.

export type AnalyticsEvent =
  | { name: 'signup_step_completed'; properties: { step: 'personal_info' | 'business_info' | 'password'; step_index: number } }
  | { name: 'dre_block_completed'; properties: { block: 'revenue' | 'direct_costs' | 'operating_expenses' | 'business_debt' | 'personal_income' | 'personal_expenses'; block_index: number } }
  | { name: 'dre_block_abandoned'; properties: { block: string; block_index: number; time_spent_seconds: number } }
  | { name: 'assessment_completed'; properties: { confidence_level: number; sector_segment: string } }
  | { name: 'bob_chat_interaction'; properties: { category: 'recommendation_question' | 'simulation_request' | 'general_question' } }
  | { name: 'institution_connection_result'; properties: { status: 'success' | 'error' | 'pending'; institution_category: string } }
  | { name: 'recommendation_clicked'; properties: { institution_category: string } }
  | { name: 'two_factor_enabled'; properties: Record<string, never> }
  | { name: 'error_occurred'; properties: { journey: string; error_type: string } }
