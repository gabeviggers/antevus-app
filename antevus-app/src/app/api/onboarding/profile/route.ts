import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { authManager } from '@/lib/security/auth-manager'
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/security/audit-logger'
import { validateCSRFToken } from '@/lib/security/csrf'
import { shouldEnforceCSRF, isDemoMode } from '@/lib/config/demo-mode'

const profileSchema = z.object({
  name: z.string()
    .min(1, "Name is required")
    .max(100, "Name too long")
    .regex(/^[a-zA-Z\s\-'\.]+$/, "Invalid characters in name"),
  organization: z.string()
    .min(1, "Organization is required")
    .max(200, "Organization name too long")
    .trim(),
  department: z.string()
    .max(100, "Department name too long")
    .optional(),
  timezone: z.string().min(1, "Timezone is required"),
  notifications: z.boolean().default(false),
  privacy: z.boolean().default(false),
  theme: z.enum(['light', 'dark', 'system']).default('system')
})

async function handlePost(request: NextRequest) {
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

    // CSRF Protection for state-changing operation
    // Skip CSRF validation in demo mode
    if (shouldEnforceCSRF()) {
      const csrfValidation = validateCSRFToken(request, userId)
      if (!csrfValidation.valid) {
        await auditLogger.log({
          eventType: AuditEventType.AUTH_LOGIN_FAILURE,
          action: 'CSRF validation failed',
          userId,
          metadata: {
            endpoint: `${request.method} ${request.url}`,
            error: csrfValidation.error,
            ip: request.headers.get('x-forwarded-for') || 'unknown'
          },
          severity: AuditSeverity.WARNING
        })

        return NextResponse.json(
          {
            error: 'CSRF validation failed',
            message: csrfValidation.error || 'Invalid or missing CSRF token'
          },
          { status: 403 }
        )
      }
    }

    // Parse and validate input
    const body = await request.json()
    const validation = profileSchema.safeParse(body)

    if (!validation.success) {
      logger.warn('Invalid profile data', {
        errors: validation.error.issues
      })
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.error.issues
      }, { status: 400 })
    }

    const profileData = validation.data

    // For demo mode, check if this is the demo user
    if (isDemoMode()) {
      // Store profile data in session storage for demo
      // In a real app, this would be stored in the database with proper authentication

      logger.info('Demo profile saved', {
        name: profileData.name,
        organization: profileData.organization,
        department: profileData.department
      })

      // Set a demo session cookie
      const response = NextResponse.json({
        success: true,
        nextStep: 'instruments',
        progress: {
          completedSteps: 1,
          totalSteps: 5,
          percentComplete: 20
        }
      })

      // Set demo session cookie
      response.cookies.set('demo-session', 'demo-active', {
        httpOnly: true,
        secure: false, // Development only
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/'
      })

      // Store demo profile data in a temporary cookie (encrypted in production)
      response.cookies.set('demo-profile', JSON.stringify(profileData), {
        httpOnly: true,
        secure: false, // Development only
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/'
      })

      return response
    }

    // In production, this would require proper authentication
    // For now, return an error if not in demo mode
    if (!isDemoMode()) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      nextStep: 'instruments',
      progress: {
        completedSteps: 1,
        totalSteps: 5,
        percentComplete: 20
      }
    })

  } catch (error) {
    logger.error('Profile API error', error)
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

    // For demo mode, retrieve from cookies
    if (isDemoMode()) {
      const profileCookie = request.cookies.get('demo-profile')
      const roleCookie = request.cookies.get('demo-role')

      let profileData = null
      let role = null

      if (profileCookie) {
        try {
          profileData = JSON.parse(profileCookie.value)
        } catch {
          logger.debug('Could not parse demo profile cookie')
        }
      }

      if (roleCookie) {
        role = roleCookie.value
      }

      return NextResponse.json({
        profileData,
        role,
        currentStep: 'profile',
        completedSteps: profileData ? ['profile'] : []
      })
    }

    // Return empty profile data if not found
    return NextResponse.json({
      profileData: null,
      role: null,
      currentStep: 'profile',
      completedSteps: []
    })

  } catch (error) {
    logger.error('Failed to retrieve profile data', error)
    return NextResponse.json(
      { error: 'Failed to retrieve profile data' },
      { status: 500 }
    )
  }
}

// Export POST handler (CSRF validation is done inline)
export const POST = handlePost