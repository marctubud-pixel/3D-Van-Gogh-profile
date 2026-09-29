import crypto from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

const PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin'
const SECRET = crypto.createHash('sha256').update(`my-world:${PASSWORD}`).digest()
const TTL_MS = 7 * 24 * 3600 * 1000

export const usingDefaultPassword = !process.env.ADMIN_PASSWORD

function sign(payload: string) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')
}

export function checkPassword(input: unknown): boolean {
  if (typeof input !== 'string') return false
  const a = crypto.createHash('sha256').update(input).digest()
  const b = crypto.createHash('sha256').update(PASSWORD).digest()
  return crypto.timingSafeEqual(a, b)
}

export function issueToken(): string {
  const payload = String(Date.now() + TTL_MS)
  return `${payload}.${sign(payload)}`
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  const expected = sign(payload)
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false
  return Number(payload) > Date.now()
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!verifyToken(token)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}
