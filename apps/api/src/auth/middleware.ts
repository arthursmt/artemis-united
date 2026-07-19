import type { NextFunction, Request, Response } from 'express'
import { clearSessionCookie, setSessionCookie } from './cookies.js'
import { SESSION_COOKIE_NAME, type SessionUser, validateSessionToken } from './session.js'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token: unknown = req.cookies?.[SESSION_COOKIE_NAME]
  if (typeof token !== 'string' || token === '') {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }

  const { session, user } = await validateSessionToken(token)
  if (!session || !user) {
    clearSessionCookie(res)
    res.status(401).json({ error: 'Not authenticated' })
    return
  }

  setSessionCookie(res, token, session.expiresAt)
  req.user = user
  next()
}
