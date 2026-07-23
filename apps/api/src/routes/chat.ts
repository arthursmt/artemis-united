import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../auth/middleware.js'
import { db } from '../db/client.js'
import { businesses } from '../db/schema.js'
import { askBob } from '../lib/anthropicClient.js'
import { fetchLatestAssessment } from '../lib/bobEngineClient.js'

export const chatRouter = Router()

chatRouter.post('/', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }

  const message = (req.body as { message?: unknown })?.message
  if (typeof message !== 'string' || message.trim() === '') {
    res.status(400).json({ error: 'message is required' })
    return
  }

  const [business] = await db.select().from(businesses).where(eq(businesses.ownerUserId, userId))
  if (!business) {
    res.status(409).json({ error: 'create a business before using the chat' })
    return
  }

  const assessmentResult = await fetchLatestAssessment(business.id)
  const assessment = assessmentResult === 'not_found' ? null : assessmentResult

  const result = await askBob(message.trim(), assessment)

  // configured:false não é um erro — é um estado normal deste ambiente sem
  // ANTHROPIC_API_KEY configurada (mesmo padrão do SENTRY_DSN vazio). O
  // cliente decide como mostrar isso ao usuário, a API nunca finge uma
  // resposta nem trava a requisição.
  res.status(200).json(result)
})
