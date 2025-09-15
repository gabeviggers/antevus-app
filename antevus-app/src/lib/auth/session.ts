import { NextRequest } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
import { randomBytes } from 'crypto'
import { User } from './types'

// Get JWT secret - in production this must be set via environment variable
function getJWTSecret(): string {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET
  }

  // Only use random secret in development
  if (process.env.NODE_ENV !== 'production') {
    return randomBytes(32).toString('hex')
  }

  // In production, require explicit secret
  throw new Error('JWT_SECRET is required in production')
}

const JWT_SECRET = getJWTSecret()
const secretKey = new TextEncoder().encode(JWT_SECRET)

// Export cookie name for consistency across the app
export const SESSION_COOKIE_NAME = 'antevus-app-auth'

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
    const cookie = request.cookies.get(SESSION_COOKIE_NAME)

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