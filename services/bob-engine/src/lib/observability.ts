import * as Sentry from '@sentry/node'

// Stack de observabilidade já decidida (Sentry + Better Stack — plano mestre,
// decisão #12). Nenhum mecanismo de log novo é criado aqui.
//
// Sentry: SDK real, inicializado normalmente — sem SENTRY_DSN configurado (.env
// vazio por padrão, nenhuma conta foi criada por esta sessão), Sentry.init() faz
// no-op e nada é enviado. Mesmo padrão já usado para o PostHog em apps/web.
//
// Better Stack: ingestão via log drain de stdout é o padrão mais comum para esse
// serviço (não requer SDK proprietário nem token para funcionar em dev) — por isso
// o evento sai como JSON estruturado em stdout, compatível com esse modo de
// ingestão. Se o setup real usar a API HTTP do Better Stack em vez de log drain,
// aqui é o único ponto a trocar.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
})

export function logStructuredEvent(name: string, data: Record<string, unknown>): void {
  const event = { event: name, timestamp: new Date().toISOString(), service: 'bob-engine', ...data }
  console.log(JSON.stringify(event))
}

export function captureAssessmentAnomaly(message: string, data: Record<string, unknown>): void {
  logStructuredEvent(message, data)
  Sentry.captureMessage(message, { level: 'warning', extra: data })
}
