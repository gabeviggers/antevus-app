import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/database'
import { logger } from '@/lib/logger'
import { isDemoMode } from '@/lib/config/demo-mode'

// Helper to get JWT secret with proper validation
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('CRITICAL: JWT_SECRET must be set in production')
      throw new Error('JWT_SECRET must be set in production')
    }
    // Only allow fallback in development
    return 'development-secret-change-in-production'
  }
  return secret
}

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
    // Check for demo mode using centralized function
    if (isDemoMode()) {
      // In demo mode, check for properly signed demo session token
      const cookieStore = await cookies()
      const demoToken = cookieStore.get('demo-session')?.value

      if (demoToken) {
        // Validate the demo JWT token
        const demoUser = await validateDemoToken(demoToken)
        if (demoUser) {
          return demoUser
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
    // Use JWT_SECRET from environment with validation
    const jwtSecret = getJwtSecret()

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
  const jwtSecret = getJwtSecret()
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

/**
 * Validate a demo session token (JWT)
 */
async function validateDemoToken(token: string): Promise<SessionUser | null> {
  try {
    const jwtSecret = getJwtSecret()

    // Verify and decode the token with specific validations
    // Restrict algorithms to prevent algorithm confusion attacks
    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'antevus-demo',
      audience: 'antevus-platform'
    }) as jwt.JwtPayload & { isDemo?: boolean; userId?: string; email?: string; role?: string }

    // Check if token is a valid demo token
    if (!decoded.isDemo || !decoded.userId) {
      logger.warn('Invalid demo token claims')
      return null
    }

    return {
      userId: decoded.userId,
      email: decoded.email || 'demo@antevus.com',
      role: decoded.role || 'admin',
      isDemo: true
    }
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.debug('Demo token expired')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.debug('Invalid demo token')
    } else {
      logger.error('Demo token validation error', error)
    }
    return null
  }
}

/**
 * Create a signed demo session token
 */
export function createDemoToken(userId: string = 'demo-user-id', email?: string): string {
  const jwtSecret = getJwtSecret()

  return jwt.sign(
    {
      userId,
      email: email || process.env.DEMO_ALLOWED_EMAIL || 'demo@antevus.com',
      role: 'admin',
      isDemo: true
    },
    jwtSecret,
    {
      expiresIn: '24h', // Demo tokens expire in 24 hours
      issuer: 'antevus-demo',
      audience: 'antevus-platform'
    } as jwt.SignOptions
  )
}

/**
 * Set secure demo session cookie
 */
export async function setDemoSessionCookie(token: string) {
  const cookieStore = await cookies()

  cookieStore.set('demo-session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/'
  })
}