import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { isDemoMode, shouldEnforceCSRF } from '@/lib/config/demo-mode'
import { authManager } from '@/lib/security/auth-manager'
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/security/audit-logger'
import { validateCSRFToken } from '@/lib/security/csrf'

const roleSchema = z.object({
  role: z.enum(['admin', 'developer', 'scientist'])
})

export async function POST(request: NextRequest) {
  try {
    // In demo mode during onboarding, use a temporary user ID
    let userId = 'onboarding-user'

    // Check for authentication (but allow bypass in demo mode for onboarding)
    if (!isDemoMode()) {
      const token = authManager.getTokenFromRequest(request)
      const session = await authManager.validateToken(token)
      if (!session?.userId) {
        auditLogger.log({
          eventType: AuditEventType.AUTH_LOGIN_FAILURE,
          action: 'Unauthorized access attempt',
          metadata: { endpoint: `${request.method} ${request.url}` },
          severity: AuditSeverity.WARNING
        })
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = session.userId
    } else {
      // In demo mode, check if there's an existing session
      const token = authManager.getTokenFromRequest(request)
      if (token) {
        const session = await authManager.validateToken(token)
        if (session?.userId) {
          userId = session.userId
        }
      }
      // If no session in demo mode, continue with onboarding-user ID
      logger.debug('Demo mode: Using temporary onboarding user', { userId })
    }

    // CSRF validation for state-changing operations
    if (shouldEnforceCSRF()) {
      const csrfValidation = validateCSRFToken(request, userId)
      if (!csrfValidation.valid) {
        await auditLogger.log({
          eventType: AuditEventType.SECURITY_CSRF_DETECTED,
          action: 'CSRF token validation failed',
          userId,
          metadata: {
            endpoint: `${request.method} ${request.url}`,
            reason: csrfValidation.error || 'Unknown'
          },
          severity: AuditSeverity.WARNING
        })
        return NextResponse.json(
          { error: 'Invalid CSRF token' },
          { status: 403 }
        )
      }
    }

    // Parse and validate input
    const body = await request.json()
    const validation = roleSchema.safeParse(body)

    if (!validation.success) {
      logger.warn('Invalid role data', {
        errors: validation.error.issues
      })
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.error.issues
      }, { status: 400 })
    }

    const { role } = validation.data

    // For demo mode, store in cookie
    if (isDemoMode()) {
      logger.info('Demo role saved', { role })

      const response = NextResponse.json({
        success: true,
        role,
        nextStep: 'profile'
      })

      // Store role in cookie for demo
      response.cookies.set('demo-role', role, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS in production, HTTP in dev
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/'
      })

      return response
    }

    // In production, would store in database
    return NextResponse.json({
      success: true,
      role,
      nextStep: 'profile'
    })

  } catch (error) {
    logger.error('Role API error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authentication
    const token = authManager.getTokenFromRequest(request)
    const session = await authManager.validateToken(token)
    if (!session?.userId) {
      auditLogger.log({
        eventType: AuditEventType.AUTH_LOGIN_FAILURE,
        action: 'Unauthorized access attempt',
        metadata: { endpoint: `${request.method} ${request.url}` },
        severity: AuditSeverity.WARNING
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // userId available via session.userId if needed

    // For demo mode, retrieve from cookie
    if (isDemoMode()) {
      const roleCookie = request.cookies.get('demo-role')

      if (roleCookie) {
        return NextResponse.json({
          role: roleCookie.value,
          success: true
        })
      }
    }

    // Return empty if not found
    return NextResponse.json({
      role: null,
      success: false
    })

  } catch (error) {
    logger.error('Failed to retrieve role', error)
    return NextResponse.json(
      { error: 'Failed to retrieve role' },
      { status: 500 }
    )
  }
}