/**
 * Authentication Wrapper for API Routes
 *
 * Provides a consistent authentication layer for all protected API routes.
 * Ensures all routes have proper authentication and session validation.
 *
 * SECURITY FEATURES:
 * - Automatic token extraction and validation
 * - Session expiration handling
 * - Audit logging for unauthorized access
 * - Consistent error responses
 */

import { NextRequest, NextResponse } from 'next/server'
import { authManager } from '@/lib/security/auth-manager'
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/security/audit-logger'
import { logger } from '@/lib/logger'

export interface AuthenticatedSession {
  userId: string
  email?: string
  roles?: string[]
  expiresAt?: Date
  isExpired?: boolean
}

/**
 * Wraps an API route handler with authentication
 *
 * @param handler - The route handler function that receives the authenticated session
 * @returns A wrapped handler that validates authentication before executing
 */
export function withAuth<T extends unknown[]>(
  handler: (
    request: NextRequest,
    session: AuthenticatedSession,
    ...args: T
  ) => Promise<NextResponse | Response>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse | Response> => {
    try {
      // Extract token from request
      const token = authManager.getTokenFromRequest(request)

      if (!token) {
        await auditLogger.log({
          eventType: AuditEventType.AUTH_LOGIN_FAILURE,
          action: 'Missing authentication token',
          metadata: {
            endpoint: `${request.method} ${request.url}`,
            ip: request.headers.get('x-forwarded-for') || 'unknown'
          },
          severity: AuditSeverity.WARNING
        })

        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }

      // Validate token and get session
      const session = await authManager.validateToken(token)

      if (!session?.userId) {
        await auditLogger.log({
          eventType: AuditEventType.AUTH_LOGIN_FAILURE,
          action: 'Invalid or expired token',
          metadata: {
            endpoint: `${request.method} ${request.url}`,
            ip: request.headers.get('x-forwarded-for') || 'unknown'
          },
          severity: AuditSeverity.WARNING
        })

        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        )
      }

      // Check if session is expired
      if (session.isExpired) {
        await auditLogger.log({
          eventType: AuditEventType.AUTH_SESSION_EXPIRED,
          action: 'Session expired',
          userId: session.userId,
          metadata: {
            endpoint: `${request.method} ${request.url}`,
            expiresAt: session.expiresAt
          },
          severity: AuditSeverity.INFO
        })

        return NextResponse.json(
          { error: 'Session expired', code: 'SESSION_EXPIRED' },
          { status: 401 }
        )
      }

      // Call the wrapped handler with the authenticated session
      return handler(request, session as AuthenticatedSession, ...args)

    } catch (error) {
      logger.error('Authentication wrapper error', error)

      await auditLogger.log({
        eventType: AuditEventType.SYSTEM_ERROR,
        action: 'Authentication system error',
        metadata: {
          endpoint: `${request.method} ${request.url}`,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        severity: AuditSeverity.ERROR
      })

      return NextResponse.json(
        { error: 'Authentication system error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Batch wrap multiple route handlers with authentication
 */
export function protectRoutes(handlers: {
  GET?: (request: NextRequest) => Promise<NextResponse | Response>
  POST?: (request: NextRequest) => Promise<NextResponse | Response>
  PUT?: (request: NextRequest) => Promise<NextResponse | Response>
  DELETE?: (request: NextRequest) => Promise<NextResponse | Response>
  PATCH?: (request: NextRequest) => Promise<NextResponse | Response>
}) {
  const protectedHandlers: typeof handlers = {}

  if (handlers.GET) {
    protectedHandlers.GET = withAuth(handlers.GET)
  }
  if (handlers.POST) {
    protectedHandlers.POST = withAuth(handlers.POST)
  }
  if (handlers.PUT) {
    protectedHandlers.PUT = withAuth(handlers.PUT)
  }
  if (handlers.DELETE) {
    protectedHandlers.DELETE = withAuth(handlers.DELETE)
  }
  if (handlers.PATCH) {
    protectedHandlers.PATCH = withAuth(handlers.PATCH)
  }

  return protectedHandlers
}