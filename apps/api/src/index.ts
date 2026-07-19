import express from 'express'
import cookieParser from 'cookie-parser'
import type { HealthStatus } from '@artemis-united/shared-types'
import { authRouter } from './routes/auth.js'

const app = express()
const port = process.env.PORT ?? 4000

app.use(express.json())
app.use(cookieParser())

app.get('/health', (_req, res) => {
  const body: HealthStatus = { status: 'ok', service: 'api' }
  res.json(body)
})

app.use('/v1/auth', authRouter)

app.listen(port, () => {
  console.log(`[api] listening on port ${port}`)
})
