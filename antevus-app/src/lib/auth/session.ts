import { NextRequest } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
import { randomBytes } from 'crypto'
import { User } from './types'
import { logger } from '@/lib/logger'

// Cache for JWT secret to avoid regenerating in development
let cachedSecret: string | null = null

// Get JWT secret - deferred to runtime to avoid build-time errors
function getSecretKey(): Uint8Array {
  if (!cachedSecret) {
    if (process.env.JWT_SECRET) {
      cachedSecret = process.env.JWT_SECRET
    } else if (process.env.NODE_ENV !== 'production') {
      // Only use random secret in development
      logger.warn('[Auth] Using random JWT secret for development. Set JWT_SECRET env var for production.')
      cachedSecret = randomBytes(32).toString('hex')
    } else {
      // In production, require explicit secret
      throw new Error('JWT_SECRET environment variable is required in production')
    }
  }

  return new TextEncoder().encode(cachedSecret)
}

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
    .sign(getSecretKey())

  return token
}

export async function getServerSession(request: NextRequest): Promise<SessionData | null> {
  try {
    const cookie = request.cookies.get(SESSION_COOKIE_NAME)

    if (!cookie?.value) {
      return null
    }

    const { payload } = await jwtVerify(cookie.value, getSecretKey())
    const session = payload.session as SessionData

    // Validate session expiry
    if (Date.now() > session.expiresAt) {
      return null
    }

    return session
  } catch (error) {
    logger.error('Session verification error', error)
    return null
  }
}

export function generateSecureToken(): string {
  return randomBytes(32).toString('hex')
}