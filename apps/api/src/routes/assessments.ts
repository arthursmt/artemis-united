import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../auth/middleware.js'
import { db } from '../db/client.js'
import { businesses } from '../db/schema.js'
import { fetchLatestAssessment } from '../lib/bobEngineClient.js'

export const assessmentsRouter = Router()

assessmentsRouter.get('/latest', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }

  const [business] = await db.select().from(businesses).where(eq(businesses.ownerUserId, userId))
  if (!business) {
    res.status(404).json({ error: 'no business found' })
    return
  }

  const result = await fetchLatestAssessment(business.id)
  if (result === 'not_found') {
    res.status(404).json({ error: 'no assessment yet' })
    return
  }

  res.status(200).json(result)
})
