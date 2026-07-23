import { timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

// Camada 2 de auth (docs/architecture.md §1.4): api -> bob-engine via shared secret
// simples no header, sem mTLS neste estágio. apps/web nunca vê esse segredo — só
// apps/api conhece o valor e o envia.
const HEADER_NAME = 'x-internal-secret'

export function requireInternalSecret(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.INTERNAL_SECRET
  if (!expected) {
    res.status(500).json({ error: 'internal auth misconfigured' })
    return
  }

  const provided = req.header(HEADER_NAME)
  if (typeof provided !== 'string' || provided === '') {
    res.status(401).json({ error: 'missing internal secret' })
    return
  }

  const expectedBuf = Buffer.from(expected)
  const providedBuf = Buffer.from(provided)
  // timingSafeEqual lança se os buffers tiverem tamanhos diferentes — checa antes.
  const isValid = expectedBuf.length === providedBuf.length && timingSafeEqual(expectedBuf, providedBuf)
  if (!isValid) {
    res.status(403).json({ error: 'invalid internal secret' })
    return
  }

  next()
}
