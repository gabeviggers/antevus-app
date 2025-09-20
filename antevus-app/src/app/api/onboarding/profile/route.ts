import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { authManager } from '@/lib/security/auth-manager'
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/security/audit-logger'
import { validateCSRFToken } from '@/lib/security/csrf'
import { shouldEnforceCSRF, isDemoMode } from '@/lib/config/demo-mode'
import { createDemoToken } from '@/lib/security/session-helper'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

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
    // Check for Supabase authentication first
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    const userId = user?.id || 'onboarding-user'

    if (!user && !isDemoMode()) {
      auditLogger.log({
        eventType: AuditEventType.AUTH_LOGIN_FAILURE,
        action: 'Unauthorized access attempt',
        metadata: { endpoint: `${request.method} ${request.url}` },
        severity: AuditSeverity.WARNING
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // CSRF Protection for state-changing operation
    // Skip CSRF validation in demo mode
    if (shouldEnforceCSRF()) {
      const csrfValidation = await validateCSRFToken(request, userId)
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

    // Save profile data for Supabase users
    if (user) {
      try {
        // Get existing role from database
        const existingData = await prisma.onboardingProgress.findUnique({
          where: { userId: user.id },
        })

        // Get existing role from profileData
        let existingRole = null
        if (existingData?.profileData) {
          try {
            const data = JSON.parse(existingData.profileData)
            existingRole = data.role
          } catch {
            // Ignore parse error
          }
        }

        // Merge role with new profile data
        const dataToStore = {
          ...profileData,
          ...(existingRole ? { role: existingRole } : {})
        }

        // Save or update profile in database
        await prisma.onboardingProgress.upsert({
          where: { userId: user.id },
          update: {
            profileData: JSON.stringify(dataToStore),
            currentStep: 'instruments',
            completedSteps: existingData?.completedSteps
              ? [...(existingData.completedSteps as string[]), 'profile']
              : ['profile'],
            updatedAt: new Date()
          },
          create: {
            userId: user.id,
            profileData: JSON.stringify(dataToStore),
            currentStep: 'instruments',
            completedSteps: ['profile'],
            isCompleted: false
          }
        })

        logger.info('Profile saved for Supabase user', {
          userId: user.id,
          email: user.email
        })

        return NextResponse.json({
          success: true,
          nextStep: 'instruments',
          progress: {
            completedSteps: 1,
            totalSteps: 5,
            percentComplete: 20
          }
        })
      } catch (_dbError) {
        logger.error('Failed to save profile to database', dbError)
        return NextResponse.json(
          { error: 'Failed to save profile' },
          { status: 500 }
        )
      }
    }

    // Fallback to demo mode if enabled
    if (isDemoMode()) {
      // Store profile data in session storage for demo
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

      // Create and set secure demo JWT token
      const demoToken = createDemoToken('demo-user-' + Date.now(), process.env.DEMO_ALLOWED_EMAIL)

      response.cookies.set('demo-session', demoToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
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

    // Not in demo mode and no auth
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )

  } catch (_error) {
    logger.error('Profile API error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check for Supabase session first
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (user) {
      // Fetch user's onboarding data from database
      try {
        const onboardingData = await prisma.onboardingProgress.findUnique({
          where: { userId: user.id },
        })

        if (onboardingData?.profileData) {
          const decryptedData = JSON.parse(onboardingData.profileData as string)
          // Extract role from profileData if it exists
          const role = decryptedData.role || null
          // Remove role from profileData since it's returned separately
          const { role: _, ...profileWithoutRole } = decryptedData

          return NextResponse.json({
            profileData: Object.keys(profileWithoutRole).length > 0 ? profileWithoutRole : null,
            role,
            currentStep: onboardingData.currentStep || 'profile',
            completedSteps: onboardingData.completedSteps || []
          })
        }
      } catch (_dbError) {
        logger.debug('No onboarding data found for user', { userId: user.id })
      }

      // Return empty data for new Supabase user
      return NextResponse.json({
        profileData: null,
        role: null,
        currentStep: 'profile',
        completedSteps: []
      })
    }

    // Fallback to demo mode if enabled and no Supabase session
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

    // Authentication (non-demo mode)
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

    // Return empty profile data if not found
    return NextResponse.json({
      profileData: null,
      role: null,
      currentStep: 'profile',
      completedSteps: []
    })

  } catch (_error) {
    logger.error('Failed to retrieve profile data', error)
    return NextResponse.json(
      { error: 'Failed to retrieve profile data' },
      { status: 500 }
    )
  }
}

// Export POST handler (CSRF validation is done inline)
export const POST = handlePost