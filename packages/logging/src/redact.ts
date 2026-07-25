import { createHash } from 'node:crypto'

// Mantém o domínio (útil pra debugar entrega de email) e a primeira letra do
// local-part, mascara o resto — nunca o endereço completo em log estruturado.
export function redactEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0 || at === email.length - 1) return '***'
  return `${email[0]}***@${email.slice(at + 1)}`
}

// Mesmas faixas da decisão #36 do plano mestre (packages/analytics —
// MoneyBracket), reimplementado aqui em vez de importado: analytics carrega
// posthog-js (dependência de browser) e é pra evento de produto, não pra log
// operacional de serviço backend. Teto alinhado ao SBA Microloan ($50k).
export type AmountBracket = '0-4999' | '5000-14999' | '15000-29999' | '30000-49999' | '50000+'
export function toAmountBracket(amount: number): AmountBracket {
  if (amount < 5000) return '0-4999'
  if (amount < 15000) return '5000-14999'
  if (amount < 30000) return '15000-29999'
  if (amount < 50000) return '30000-49999'
  return '50000+'
}

// Hash determinístico e truncado — mesmo id sempre gera o mesmo hash (dá pra
// correlacionar linhas de log do mesmo registro), mas não permite recuperar o
// id original nem reidentificar por busca reversa trivial. Prefixo deixa
// explícito no log que aquele valor é um hash, não o id real.
export function hashId(id: string): string {
  return `h_${createHash('sha256').update(id).digest('hex').slice(0, 16)}`
}
