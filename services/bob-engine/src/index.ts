import './lib/observability.js'
import express from 'express'
import type { HealthStatus } from '@artemis-united/shared-types'
import { requireInternalSecret } from './auth/internalSecret.js'
import { assessmentsRouter } from './routes/assessments.js'

// This service is intentionally isolated: it must never import from
// apps/api or apps/web. It only depends on shared, app-agnostic packages.

const app = express()
const port = process.env.PORT ?? 4100

app.use(express.json())

app.get('/health', (_req, res) => {
  const body: HealthStatus = { status: 'ok', service: 'bob-engine' }
  res.json(body)
})

// Etapa 4: auth interna api -> bob-engine (docs/architecture.md §1.4, decisão #8) —
// shared secret no header X-Internal-Secret, sem mTLS neste estágio. apps/web nunca
// bate aqui direto, só apps/api conhece o segredo.
app.use('/v1/assessments', requireInternalSecret, assessmentsRouter)

app.listen(port, () => {
  console.log(`[bob-engine] listening on port ${port}`)
})
