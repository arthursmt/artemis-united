import express from 'express'
import type { HealthStatus } from '@artemis-united/shared-types'

// This service is intentionally isolated: it must never import from
// apps/api or apps/web. It only depends on shared, app-agnostic packages.

const app = express()
const port = process.env.PORT ?? 4100

app.get('/health', (_req, res) => {
  const body: HealthStatus = { status: 'ok', service: 'bob-engine' }
  res.json(body)
})

app.listen(port, () => {
  console.log(`[bob-engine] listening on port ${port}`)
})
