import './lib/observability.js'
import express from 'express'
import type { HealthStatus } from '@artemis-united/shared-types'
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

// Etapa 3 do walking skeleton: sem autenticação por enquanto — bate direto no
// bob-engine, sem passar por apps/api. Camada de auth entra quando apps/api
// assumir o proxy (ver docs/architecture.md, seção 1.4).
app.use('/v1/assessments', assessmentsRouter)

app.listen(port, () => {
  console.log(`[bob-engine] listening on port ${port}`)
})
