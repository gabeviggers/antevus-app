import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { isDemoMode, shouldEnforceCSRF } from '@/lib/config/demo-mode'
import { authManager } from '@/lib/security/auth-manager'
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/security/audit-logger'
import { validateCSRFToken } from '@/lib/security/csrf'

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

    const body = await request.json()

    // For demo mode, track progress
    if (isDemoMode()) {
      logger.info('Demo onboarding progress', {
        step: body.step,
        completed: body.completed,
        onboardingComplete: body.onboardingComplete,
        skipped: body.skipped
      })

      const response = NextResponse.json({
        success: true,
        message: body.onboardingComplete ? 'Onboarding completed!' : 'Progress saved',
        redirectTo: body.onboardingComplete ? '/dashboard' : undefined
      })

      // If onboarding is complete, set completion cookie and auth token
      if (body.onboardingComplete) {
        response.cookies.set('demo-onboarding-complete', 'true', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production', // HTTPS in production, HTTP in dev
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: '/'
        })

        // Ensure demo session stays active
        response.cookies.set('demo-session', 'demo-active', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production', // HTTPS in production, HTTP in dev
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: '/'
        })

        // Set session identifier for the session context to recognize
        // Using httpOnly cookie for security - no raw tokens in client-readable storage
        response.cookies.set('session-id', 'demo-session-admin', {
          httpOnly: true, // Security: prevent client-side JS access
          secure: process.env.NODE_ENV === 'production', // HTTPS in production, HTTP in dev
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: '/'
        })
      }

      return response
    }

    // In production, would update database
    return NextResponse.json({
      success: true,
      message: 'Progress saved'
    })

  } catch (error) {
    logger.error('Progress API error', error)
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

    // Check progress for demo
    if (isDemoMode()) {
      const completeCookie = request.cookies.get('demo-onboarding-complete')
      const roleCookie = request.cookies.get('demo-role')

      return NextResponse.json({
        isCompleted: completeCookie?.value === 'true',
        role: roleCookie?.value || null,
        needsOnboarding: completeCookie?.value !== 'true'
      })
    }

    return NextResponse.json({
      isCompleted: false,
      role: null,
      needsOnboarding: true
    })

  } catch (error) {
    logger.error('Failed to check progress', error)
    return NextResponse.json(
      { error: 'Failed to check progress' },
      { status: 500 }
    )
  }
}