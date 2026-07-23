// Chat com BoB (Etapa 5, seção 4.6) — "encanação" mínima: monta o prompt com a
// voz do BoB (seção 5.4: calorosa, direta, linguagem simples, não-julgadora) +
// o assessment mais recente do negócio, chama a API da Claude de verdade.
//
// Mesmo padrão do SENTRY_DSN em services/bob-engine: sem ANTHROPIC_API_KEY no
// ambiente, não simula resposta nem trava — devolve um estado explícito de
// "não configurado" pro chamador decidir o que mostrar ao usuário.
import type { AssessmentView } from './bobEngineClient.js'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-sonnet-5'
const ANTHROPIC_VERSION = '2023-06-01'
const MAX_TOKENS = 1024

const SYSTEM_PROMPT = `Você é o BoB, assistente financeiro do Artemis United para donos de pequenos
negócios nos EUA. Seu tom é caloroso, direto e usa linguagem simples — nunca jargão financeiro
sem explicar, nunca um tom que julgue as decisões financeiras do usuário. Responda à pergunta
dele de forma útil, concisa, e sempre em português (a menos que ele pergunte em inglês).`

function buildAssessmentContext(assessment: AssessmentView | null): string {
  if (!assessment) {
    return 'O usuário ainda não tem nenhuma avaliação de capacidade de crédito calculada.'
  }
  return [
    'Avaliação mais recente do negócio do usuário:',
    `- Valor recomendado: ${assessment.recommendedAmount ?? 'não calculado'} ${assessment.currency}`,
    `- Nível de confiança: ${assessment.confidenceLevel ?? 'não calculado'}`,
    `- Resultado operacional líquido (NOI) mensal: ${assessment.noi}`,
    `- DSCR-alvo: ${assessment.dscrTarget}`,
    `- Capacidade mensal de nova dívida: ${assessment.monthlyNewDebtCapacity}`,
    assessment.exceedsMicroloanCeiling
      ? '- Esse valor passa do teto do produto de crédito de referência (microloan).'
      : null,
  ]
    .filter((line) => line !== null)
    .join('\n')
}

export type AskBobResult = { configured: false } | { configured: true; reply: string }

export async function askBob(userMessage: string, assessment: AssessmentView | null): Promise<AskBobResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { configured: false }
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      system: `${SYSTEM_PROMPT}\n\n${buildAssessmentContext(assessment)}`,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Anthropic API request failed with status ${response.status}`)
  }

  const body = (await response.json()) as { content: { type: string; text?: string }[] }
  const reply = body.content.find((block) => block.type === 'text')?.text ?? ''

  return { configured: true, reply }
}
