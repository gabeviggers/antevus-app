/**
 * CSRF Middleware for Next.js API Routes
 *
 * Provides systematic CSRF protection for all state-changing operations.
 * Uses the existing CSRF validation infrastructure with a middleware pattern.
 *
 * SECURITY FEATURES:
 * - Automatic CSRF validation for POST/PUT/DELETE/PATCH
 * - Skips validation for safe methods (GET, HEAD, OPTIONS)
 * - Integration with audit logging
 * - Production-ready with development mode bypass
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateCSRFToken } from './csrf'
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/security/audit-logger'
import { logger } from '@/lib/logger'
import { isFeatureEnabled } from '@/lib/config/features'

/**
 * CSRF protection middleware for API routes
 * Wraps handlers to automatically validate CSRF tokens
 */
export function withCSRF<T extends unknown[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse | Response>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse | Response> => {
    // Server-side check: Skip CSRF if feature is disabled or in demo mode
    // Note: This uses server-side env vars only, never NEXT_PUBLIC_* vars
    const csrfEnabled = isFeatureEnabled('csrfProtection')
    const isDemoMode = process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true'

    if (!csrfEnabled || isDemoMode) {
      logger.debug('CSRF validation skipped', { csrfEnabled, isDemoMode })
      return handler(request, ...args)
    }

    // Skip CSRF for safe methods
    const method = request.method.toUpperCase()
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return handler(request, ...args)
    }

    // Extract user ID from request (if available)
    // This would come from the authenticated session
    const userId = request.headers.get('x-user-id') || 'anonymous'

    // Validate CSRF token
    const validation = validateCSRFToken(request, userId)

    if (!validation.valid) {
      // Log the CSRF failure
      await auditLogger.log({
        eventType: AuditEventType.SECURITY_CSRF_DETECTED,
        action: 'CSRF validation failed',
        userId,
        metadata: {
          endpoint: `${method} ${request.url}`,
          error: validation.error,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
          type: 'csrf_violation'
        },
        severity: AuditSeverity.WARNING
      })

      // Return 403 Forbidden
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: validation.error || 'Invalid or missing CSRF token'
        },
        { status: 403 }
      )
    }

    // CSRF validation passed, proceed with the handler
    return handler(request, ...args)
  }
}

/**
 * Helper to apply CSRF protection to multiple methods at once
 */
export function protectWithCSRF(handlers: {
  GET?: (request: NextRequest) => Promise<NextResponse | Response>
  POST?: (request: NextRequest) => Promise<NextResponse | Response>
  PUT?: (request: NextRequest) => Promise<NextResponse | Response>
  DELETE?: (request: NextRequest) => Promise<NextResponse | Response>
  PATCH?: (request: NextRequest) => Promise<NextResponse | Response>
}) {
  const protectedHandlers: typeof handlers = {}

  // GET doesn't need CSRF protection
  if (handlers.GET) {
    protectedHandlers.GET = handlers.GET
  }

  // Apply CSRF protection to state-changing methods
  if (handlers.POST) {
    protectedHandlers.POST = withCSRF(handlers.POST)
  }
  if (handlers.PUT) {
    protectedHandlers.PUT = withCSRF(handlers.PUT)
  }
  if (handlers.DELETE) {
    protectedHandlers.DELETE = withCSRF(handlers.DELETE)
  }
  if (handlers.PATCH) {
    protectedHandlers.PATCH = withCSRF(handlers.PATCH)
  }

  return protectedHandlers
}

/**
 * Generate CSRF token header for responses
 */
export function addCSRFHeader(response: NextResponse): NextResponse {
  // In production, the CSRF token would be generated and added to the response
  if (process.env.NODE_ENV === 'production') {
    // Token would be retrieved from the session or generated
    const token = 'csrf-token-placeholder' // This would be the actual token
    response.headers.set('X-CSRF-Token', token)
  }
  return response
}