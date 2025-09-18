/**
 * Secure Session Management
 * Production-ready session handling with encrypted cookies
 */

import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { User } from '@/lib/auth/types'
import { UserRole } from '@/lib/security/authorization'
import { logger } from '@/lib/logger'
import { auditLogger } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'

// Session configuration
const SESSION_COOKIE_NAME = '__Host-session' // __Host- prefix for security
const SESSION_EXPIRY = '24h'
const REFRESH_THRESHOLD = 60 * 60 * 1000 // Refresh if less than 1 hour left

// Get session secret from environment
function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET

  if (!secret) {
    if (process.env.NODE_ENV !== 'production') {
      return new TextEncoder().encode('dev-session-secret-min-32-characters!')
    }
    throw new Error('SESSION_SECRET is required in production')
  }

  if (secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters')
  }

  return new TextEncoder().encode(secret)
}

export interface SessionData {
  userId: string
  email: string
  name: string
  role: string
  sessionId: string
  createdAt: number
  expiresAt: number
  ipAddress?: string
  userAgent?: string
  organization?: string
  department?: string
}

/**
 * Create a new secure session
 */
export async function createSecureSession(
  user: User,
  request?: NextRequest
): Promise<string> {
  try {
    const sessionId = crypto.randomUUID()
    const now = Date.now()
    const expiresAt = now + (24 * 60 * 60 * 1000) // 24 hours

    // Store session in database
    await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        token: sessionId, // We'll use JWT for the actual token
        ipAddress: request?.headers.get('x-forwarded-for')?.split(',')[0] || undefined,
        userAgent: request?.headers.get('user-agent') || undefined,
        expiresAt: new Date(expiresAt)
      }
    })

    // Create JWT session token
    const sessionData: SessionData = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sessionId,
      createdAt: now,
      expiresAt,
      ipAddress: request?.headers.get('x-forwarded-for')?.split(',')[0],
      userAgent: request?.headers.get('user-agent') || undefined,
      organization: user.organization,
      department: user.department
    }

    const secret = getSessionSecret()
    const token = await new SignJWT({ ...sessionData })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(SESSION_EXPIRY)
      .setIssuedAt()
      .setSubject(user.id)
      .sign(secret)

    // Log session creation
    await auditLogger.logEvent(user, 'user.login', {
      resourceType: 'session',
      resourceId: sessionId,
      success: true,
      metadata: {
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent
      }
    })

    return token
  } catch (error) {
    logger.error('Failed to create session', error, { userId: user.id })
    throw new Error('Failed to create session')
  }
}

/**
 * Verify and decode a session token
 */
export async function verifySession(token: string): Promise<SessionData | null> {
  try {
    const secret = getSessionSecret()
    const { payload } = await jwtVerify(token, secret)

    // Cast payload to unknown first, then to SessionData
    const sessionData = payload as unknown as SessionData

    // Verify session still exists in database
    const dbSession = await prisma.session.findUnique({
      where: { id: sessionData.sessionId }
    })

    if (!dbSession || dbSession.expiresAt < new Date()) {
      return null
    }

    return sessionData
  } catch (error) {
    logger.debug('Session verification failed', { error })
    return null
  }
}

/**
 * Get session from cookies
 */
export async function getSessionFromCookies(): Promise<SessionData | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)

  if (!sessionCookie) {
    return null
  }

  return await verifySession(sessionCookie.value)
}

/**
 * Refresh session if needed
 */
export async function refreshSessionIfNeeded(
  session: SessionData,
  response: NextResponse
): Promise<NextResponse> {
  const timeUntilExpiry = session.expiresAt - Date.now()

  if (timeUntilExpiry < REFRESH_THRESHOLD) {
    // Refresh the session
    const user: User = {
      id: session.userId,
      email: session.email,
      name: session.name,
      role: session.role as UserRole,
      organization: session.organization || 'Unknown',
      createdAt: new Date(session.createdAt).toISOString()
    }

    const newToken = await createSecureSession(user)
    setSecureSessionCookie(response, newToken)
  }

  return response
}

/**
 * Set secure session cookie
 */
export function setSecureSessionCookie(
  response: NextResponse,
  token: string
): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 24 * 60 * 60 // 24 hours
  })

  return response
}

/**
 * Clear session (logout)
 */
export async function clearSession(sessionId?: string): Promise<void> {
  if (sessionId) {
    // Mark session as expired in database
    await prisma.session.update({
      where: { id: sessionId },
      data: { expiresAt: new Date() }
    }).catch(error => {
      logger.error('Failed to expire session in database', error, { sessionId })
    })
  }
}

/**
 * Authenticate user with email and password
 * NEVER accept passwords from URL parameters!
 */
export async function authenticateUser(
  email: string,
  password: string,
  request?: NextRequest
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    // Find user in database
    const dbUser = await prisma.user.findUnique({
      where: { email }
    })

    if (!dbUser) {
      await auditLogger.logEvent(null, 'user.failed_login', {
        resourceType: 'authentication',
        resourceId: email,
        success: false,
        errorMessage: 'User not found',
        metadata: {
          email,
          ipAddress: request?.headers.get('x-forwarded-for')?.split(',')[0]
        }
      })
      return { success: false, error: 'Invalid credentials' }
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, dbUser.passwordHash)

    if (!validPassword) {
      await auditLogger.logEvent(null, 'user.failed_login', {
        resourceType: 'authentication',
        resourceId: email,
        success: false,
        errorMessage: 'Invalid password',
        metadata: {
          email,
          ipAddress: request?.headers.get('x-forwarded-for')?.split(',')[0]
        }
      })
      return { success: false, error: 'Invalid credentials' }
    }

    // Check if user is active
    if (!dbUser.isActive) {
      await auditLogger.logEvent(null, 'user.failed_login', {
        resourceType: 'authentication',
        resourceId: email,
        success: false,
        errorMessage: 'Account disabled',
        metadata: {
          email,
          ipAddress: request?.headers.get('x-forwarded-for')?.split(',')[0]
        }
      })
      return { success: false, error: 'Account disabled' }
    }

    // Update last login
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { lastLoginAt: new Date() }
    })

    const user: User = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role as UserRole,
      organization: 'Unknown', // Add organization to database schema if needed
      createdAt: dbUser.createdAt.toISOString()
    }

    return { success: true, user }
  } catch (error) {
    logger.error('Authentication failed', error, { email })
    return { success: false, error: 'Authentication failed' }
  }
}

/**
 * Session cleanup job - remove expired sessions
 * Should be run periodically (e.g., every hour)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    })

    logger.info('Cleaned up expired sessions', { count: result.count })
    return result.count
  } catch (error) {
    logger.error('Failed to cleanup expired sessions', error)
    return 0
  }
}