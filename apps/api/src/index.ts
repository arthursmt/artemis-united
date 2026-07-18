import express from 'express'
import type { HealthStatus } from '@artemis-united/shared-types'

const app = express()
const port = process.env.PORT ?? 4000

app.get('/health', (_req, res) => {
  const body: HealthStatus = { status: 'ok', service: 'api' }
  res.json(body)
})

app.listen(port, () => {
  console.log(`[api] listening on port ${port}`)
})
