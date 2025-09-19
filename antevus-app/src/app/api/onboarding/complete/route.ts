import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRateLimit } from '@/lib/api/rate-limit-helper'
import { authManager } from '@/lib/security/auth-manager'
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/security/audit-logger'
import { validateCSRFToken } from '@/lib/security/csrf'
// import { encryptionService } from '@/lib/security/encryption-service' // TODO: Re-enable when needed
import { prisma } from '@/lib/database'
import { logger } from '@/lib/logger'

const completeSchema = z.object({
  finalStep: z.string(),
  feedback: z.string().optional(),
  startFirstRun: z.boolean().optional().default(false),
  preferences: z.object({
    dashboardLayout: z.enum(['grid', 'list']).optional(),
    defaultView: z.enum(['instruments', 'runs', 'monitoring']).optional(),
    emailNotifications: z.boolean().optional(),
    slackIntegration: z.boolean().optional()
  }).optional()
})

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimited = await withRateLimit(request, {
      key: 'api:onboarding:complete',
      limit: 5,
      window: 60000
    })
    if (rateLimited) return rateLimited

    // CSRF Protection for state-changing operation
    // Skip CSRF validation in development/demo mode
    if (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') {
      // Extract user ID from token for CSRF validation
      const token = authManager.getTokenFromRequest(request)
      const tempSession = await authManager.validateToken(token)
      const userId = tempSession?.userId || 'anonymous'

      // Validate CSRF token
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
    const userId = session.userId
    const userRoles = session.roles || []

    // Parse and validate input
    const body = await request.json()
    const validation = completeSchema.safeParse(body)

    if (!validation.success) {
      logger.warn('Invalid completion data', {
        errors: validation.error.issues
      })
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.error.issues
      }, { status: 400 })
    }

    const completionData = validation.data

    // Get existing onboarding progress
    const existingProgress = await prisma.onboardingProgress.findUnique({
      where: { userId },
      select: {
        completedSteps: true,
        profileData: true,
        instrumentsData: true,
        teamData: true
      }
    })

    if (!existingProgress) {
      return NextResponse.json(
        { error: 'Onboarding progress not found. Please start from the beginning.' },
        { status: 404 }
      )
    }

    // Ensure all required steps are completed
    // Determine the final step based on user role
    const isAdmin = userRoles.includes('admin') || userRoles.includes('lab_manager')

    // The canonical 5-step onboarding flow:
    // - Core steps: profile -> instruments -> agent -> endpoints
    // - Final step: team (for admin/lab_manager) OR hello (for regular users)
    const coreSteps = ['profile', 'instruments', 'agent', 'endpoints']
    const requiredSteps = isAdmin
      ? [...coreSteps, 'team']
      : coreSteps

    const missingSteps = requiredSteps.filter(
      step => !existingProgress.completedSteps.includes(step)
    )

    if (missingSteps.length > 0) {
      logger.warn('Attempted to complete onboarding with missing steps', {
        userId,
        missingSteps,
        completedSteps: existingProgress.completedSteps
      })

      return NextResponse.json({
        error: 'Incomplete onboarding',
        missingSteps,
        message: 'Please complete all required steps before finishing onboarding',
        requiredSteps,
        completedSteps: existingProgress.completedSteps
      }, { status: 400 })
    }

    // Mark onboarding as complete
    const completedAt = new Date()

    // Use the previously determined final step based on user role
    const finalStep = isAdmin ? 'team' : 'hello'

    // Add the appropriate final step to completed steps
    const updatedSteps = Array.from(new Set([...existingProgress.completedSteps, finalStep]))

    await prisma.onboardingProgress.update({
      where: { userId },
      data: {
        completedSteps: updatedSteps,
        currentStep: 'completed',
        isCompleted: true,
        completedAt,
        updatedAt: completedAt
      }
    })

    // Update user record to mark onboarding as complete (skip in demo mode)
    if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: {
            onboardingCompletedAt: completedAt,
            updatedAt: completedAt
          }
        })
      } catch (error) {
        // User record may not exist in demo mode - continue silently
        logger.warn('Could not update user record', { userId, error })
      }
    }

    // Calculate onboarding duration for analytics
    const startTime = await prisma.onboardingProgress.findUnique({
      where: { userId },
      select: { startedAt: true }
    })

    const duration = startTime?.startedAt
      ? completedAt.getTime() - startTime.startedAt.getTime()
      : null

    // Comprehensive audit log for completion
    await auditLogger.log({
      eventType: AuditEventType.DATA_ACCESS_GRANTED,
      action: 'onboarding.completed',
      userId,
      metadata: {
        completionTime: completedAt.toISOString(),
        totalSteps: updatedSteps.length,
        completedSteps: updatedSteps,
        duration: duration ? `${Math.round(duration / 1000)}s` : null,
        startFirstRun: completionData.startFirstRun,
        hasFeedback: !!completionData.feedback,
        preferences: completionData.preferences
      },
      severity: AuditSeverity.INFO
    })

    // Log user feedback if provided (for product improvement)
    if (completionData.feedback) {
      logger.info('Onboarding feedback received', {
        userId,
        feedbackLength: completionData.feedback.length
      })
    }

    logger.info('Onboarding completed successfully', {
      userId,
      duration,
      stepsCompleted: updatedSteps.length
    })

    // Prepare response with next actions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = {
      success: true,
      onboardingCompleted: true,
      completedAt: completedAt.toISOString(),
      redirectTo: '/dashboard',
      message: 'Welcome to Antevus! Your onboarding is complete.'
    }

    // Include optional dashboard configuration
    if (completionData.startFirstRun) {
      response.startFirstRun = true
      response.firstRunUrl = '/dashboard?firstRun=true'
    }

    if (completionData.preferences) {
      response.preferences = completionData.preferences
    }

    return NextResponse.json(response)

  } catch (error) {
    logger.error('Complete API error', error)

    await auditLogger.log({
      eventType: AuditEventType.SYSTEM_ERROR,
      action: 'onboarding.complete.error',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      severity: AuditSeverity.ERROR
    })

    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    )
  }
}

// GET endpoint to check if onboarding is complete
export async function GET(request: Request) {
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
    const userId = session.userId

    // Check onboarding status
    const progress = await prisma.onboardingProgress.findUnique({
      where: { userId },
      select: {
        isCompleted: true,
        completedAt: true,
        completedSteps: true,
        currentStep: true
      }
    })

    if (!progress) {
      return NextResponse.json({
        isCompleted: false,
        needsOnboarding: true,
        currentStep: 'profile',
        completedSteps: []
      })
    }

    return NextResponse.json({
      isCompleted: progress.isCompleted,
      completedAt: progress.completedAt,
      needsOnboarding: !progress.isCompleted,
      currentStep: progress.currentStep,
      completedSteps: progress.completedSteps,
      progress: Math.round((progress.completedSteps.length / 5) * 100)
    })

  } catch (error) {
    logger.error('Failed to check completion status', error)
    return NextResponse.json(
      { error: 'Failed to check completion status' },
      { status: 500 }
    )
  }
}