import { NextRequest } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
import { randomBytes } from 'crypto'
import { User } from './types'

const JWT_SECRET = process.env.JWT_SECRET || randomBytes(32).toString('hex')
const secretKey = new TextEncoder().encode(JWT_SECRET)

export interface SessionData {
  user: User
  csrfToken: string
  createdAt: number
  expiresAt: number
}

export async function createSecureSession(user: User): Promise<string> {
  const csrfToken = randomBytes(32).toString('hex')
  const now = Date.now()

  const session: SessionData = {
    user,
    csrfToken,
    createdAt: now,
    expiresAt: now + (7 * 24 * 60 * 60 * 1000) // 7 days
  }

  const token = await new SignJWT({ session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey)

  return token
}

export async function getServerSession(request: NextRequest): Promise<SessionData | null> {
  try {
    const cookie = request.cookies.get('session')

    if (!cookie?.value) {
      return null
    }

    const { payload } = await jwtVerify(cookie.value, secretKey)
    const session = payload.session as SessionData

    // Validate session expiry
    if (Date.now() > session.expiresAt) {
      return null
    }

    return session
  } catch (error) {
    console.error('Session verification error:', error)
    return null
  }
}

export function generateSecureToken(): string {
  return randomBytes(32).toString('hex')
}