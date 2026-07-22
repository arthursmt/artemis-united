import express from 'express'
import cookieParser from 'cookie-parser'
import type { HealthStatus } from '@artemis-united/shared-types'
import { assessmentsRouter } from './routes/assessments.js'
import { authRouter } from './routes/auth.js'
import { businessesRouter } from './routes/businesses.js'
import { financialStatementsRouter } from './routes/financialStatements.js'

const app = express()
const port = process.env.PORT ?? 4000

app.use(express.json())
app.use(cookieParser())

app.get('/health', (_req, res) => {
  const body: HealthStatus = { status: 'ok', service: 'api' }
  res.json(body)
})

app.use('/v1/auth', authRouter)
app.use('/v1/businesses', businessesRouter)
app.use('/v1/financial-statements', financialStatementsRouter)
app.use('/v1/assessments', assessmentsRouter)

app.listen(port, () => {
  console.log(`[api] listening on port ${port}`)
})
