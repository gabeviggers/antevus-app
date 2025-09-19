import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/database'
import { logger } from '@/lib/logger'

export interface SessionUser {
  userId: string
  email: string
  role: string
  isDemo?: boolean
}

/**
 * Get server session from request
 * Handles both regular JWT sessions and demo mode
 */
export async function getServerSession(request: NextRequest): Promise<SessionUser | null> {
  try {
    // Check for demo mode first (development only)
    if (process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true') {
      // In demo mode, check for demo session cookie or header
      const cookieStore = await cookies()
      const demoToken = cookieStore.get('demo-session')?.value

      if (demoToken === 'demo-active') {
        return {
          userId: 'demo-user-id',
          email: process.env.DEMO_ALLOWED_EMAIL || 'demo@antevus.com',
          role: 'admin',
          isDemo: true
        }
      }
    }

    // Check for Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      // Check for session cookie as fallback
      const cookieStore = await cookies()
      const sessionToken = cookieStore.get('session-token')?.value

      if (!sessionToken) {
        return null
      }

      // Validate session token from cookie
      return validateSessionToken(sessionToken)
    }

    // Extract and validate JWT token
    const token = authHeader.substring(7)
    return validateSessionToken(token)

  } catch (error) {
    logger.error('Session validation error', error)
    return null
  }
}

/**
 * Validate a session token (JWT)
 */
async function validateSessionToken(token: string): Promise<SessionUser | null> {
  try {
    // Use JWT_SECRET from environment
    const jwtSecret = process.env.JWT_SECRET || 'development-secret-change-in-production'

    // Verify and decode the token
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = jwt.verify(token, jwtSecret) as any

    if (!decoded.userId) {
      return null
    }

    // Optionally verify the user still exists and is active
    if (process.env.NODE_ENV === 'production') {
      const user = await prisma.user.findUnique({
        where: {
          id: decoded.userId,
          isActive: true
        },
        select: {
          id: true,
          email: true,
          role: true
        }
      })

      if (!user) {
        return null
      }

      return {
        userId: user.id,
        email: user.email,
        role: user.role,
        isDemo: false
      }
    }

    // In development, trust the token
    return {
      userId: decoded.userId,
      email: decoded.email || 'unknown',
      role: decoded.role || 'viewer',
      isDemo: false
    }

  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.debug('Token expired')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.debug('Invalid token')
    } else {
      logger.error('Token validation error', error)
    }
    return null
  }
}

/**
 * Create a new session token
 */
export function createSessionToken(user: SessionUser): string {
  const jwtSecret = process.env.JWT_SECRET || 'development-secret-change-in-production'
  const expiresIn = process.env.JWT_EXPIRATION || '7d'

  return jwt.sign(
    {
      userId: user.userId,
      email: user.email,
      role: user.role,
      isDemo: user.isDemo
    },
    jwtSecret,
    {
      expiresIn: expiresIn
    } as jwt.SignOptions
  )
}

/**
 * Set secure session cookie
 */
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()

  cookieStore.set('session-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/'
  })
}

/**
 * Clear session cookie
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete('session-token')
  cookieStore.delete('demo-session')
}