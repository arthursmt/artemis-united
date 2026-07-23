// Precisa ser importado antes de qualquer router ser criado — faz patch nos métodos
// do express.Router pra rejeições de handler async caírem no error-handling
// middleware abaixo, em vez de deixar a requisição pendurada (Express 4 não faz
// isso sozinho; é nativo a partir do Express 5).
import 'express-async-errors'
import express from 'express'
import cookieParser from 'cookie-parser'
import type { HealthStatus } from '@artemis-united/shared-types'
import { assessmentsRouter } from './routes/assessments.js'
import { authRouter } from './routes/auth.js'
import { businessesRouter } from './routes/businesses.js'
import { customerProfileRouter } from './routes/customerProfile.js'
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
app.use('/v1/customer-profile', customerProfileRouter)
app.use('/v1/businesses', businessesRouter)
app.use('/v1/financial-statements', financialStatementsRouter)
app.use('/v1/assessments', assessmentsRouter)

// Rede de segurança genérica — qualquer erro não tratado explicitamente por uma rota
// (síncrono, ou assíncrono via express-async-errors acima) cai aqui em vez de deixar
// a requisição pendurada ou vazar stack trace. Rotas continuam livres pra tratar
// casos específicos antes disso (ex: unique_violation -> 409 em routes/businesses.ts).
// Express só reconhece esta função como error handler pela aridade de 4 parâmetros —
// _next precisa existir mesmo sem uso.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api] unhandled error', err)
  res.status(500).json({ error: 'unexpected error' })
})

app.listen(port, () => {
  console.log(`[api] listening on port ${port}`)
})
