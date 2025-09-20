import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { isDemoMode, shouldEnforceCSRF } from '@/lib/config/demo-mode'
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/security/audit-logger'
import { validateCSRFToken } from '@/lib/security/csrf'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

const roleSchema = z.object({
  role: z.enum(['admin', 'developer', 'scientist'])
})

export async function POST(request: NextRequest) {
  try {
    // Check for Supabase authentication first
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

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

    // Save role for Supabase users
    if (user) {
      try {
        // First, fetch existing onboarding progress to preserve profileData
        const existingProgress = await prisma.onboardingProgress.findUnique({
          where: { userId: user.id },
          select: { profileData: true }
        })

        // Parse existing profile data, defaulting to empty object on error
        let existingProfileData = {}
        if (existingProgress?.profileData) {
          try {
            existingProfileData = JSON.parse(existingProgress.profileData)
          } catch (parseError) {
            logger.warn('Failed to parse existing profileData', {
              userId: user.id,
              error: parseError instanceof Error ? parseError.message : 'Unknown parse error'
            })
            // Continue with empty object as fallback
          }
        }

        // Merge new role with existing profile data
        const updatedProfileData = {
          ...existingProfileData,
          role // This overwrites only the role field
        }

        // Save or update role in database
        await prisma.onboardingProgress.upsert({
          where: { userId: user.id },
          update: {
            profileData: JSON.stringify(updatedProfileData),
            currentStep: 'profile',
            updatedAt: new Date()
          },
          create: {
            userId: user.id,
            profileData: JSON.stringify(updatedProfileData),
            currentStep: 'profile',
            completedSteps: [],
            isCompleted: false
          }
        })

        logger.info('Role saved for Supabase user', {
          userId: user.id,
          email: user.email,
          role
        })

        return NextResponse.json({
          success: true,
          role,
          nextStep: 'profile'
        })
      } catch (dbError) {
        logger.error('Failed to save role to database', {
          error: dbError instanceof Error ? dbError.message : String(dbError),
          stack: dbError instanceof Error ? dbError.stack : undefined,
          userId: user.id,
          role
        })
        return NextResponse.json(
          {
            error: 'Failed to save role',
            details: dbError instanceof Error ? dbError.message : 'Database error'
          },
          { status: 500 }
        )
      }
    }

    // Fallback to demo mode if enabled
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
        secure: process.env.NODE_ENV === 'production',
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
    // Check for Supabase session first
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      // Fetch role from database
      try {
        const onboardingData = await prisma.onboardingProgress.findUnique({
          where: { userId: user.id },
        })

        let role = null
        if (onboardingData?.profileData) {
          try {
            const data = JSON.parse(onboardingData.profileData)
            role = data.role
          } catch {
            // Ignore parse error
          }
        }

        return NextResponse.json({
          role,
          success: !!role
        })
      } catch (dbError) {
        logger.debug('No role found for user', { userId: user.id })
        return NextResponse.json({
          role: null,
          success: false
        })
      }
    }

    // Fallback to demo mode if enabled
    if (isDemoMode()) {
      const roleCookie = request.cookies.get('demo-role')

      if (roleCookie) {
        return NextResponse.json({
          role: roleCookie.value,
          success: true
        })
      }

      return NextResponse.json({
        role: null,
        success: false
      })
    }

    // No auth and not in demo mode
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  } catch (error) {
    logger.error('Failed to retrieve role', error)
    return NextResponse.json(
      { error: 'Failed to retrieve role' },
      { status: 500 }
    )
  }
}