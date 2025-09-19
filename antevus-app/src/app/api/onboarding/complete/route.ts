import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRateLimit } from '@/lib/api/rate-limit-helper'
// import { authManager } from '@/lib/security/auth-manager' // TODO: Re-enable when needed
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/security/audit-logger'
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

    // Authentication
    const token = process.env.NODE_ENV === "development" ? "demo-token" : null // authManager.getTokenFromRequest(request)
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = 'demo-user-id'
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implement proper authentication
      // const session = await authManager.validateToken(token)
      // if (!session?.userId) {
      //   return NextResponse.json(
      //     { error: 'Invalid session' },
      //     { status: 401 }
      //   )
      // }
      // userId = session.userId
      return NextResponse.json(
        { error: 'Authentication not yet implemented' },
        { status: 501 }
      )
    }

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
    const requiredSteps = ['profile', 'instruments']
    const missingSteps = requiredSteps.filter(
      step => !existingProgress.completedSteps.includes(step)
    )

    if (missingSteps.length > 0) {
      return NextResponse.json({
        error: 'Incomplete onboarding',
        missingSteps,
        message: 'Please complete all required steps before finishing onboarding'
      }, { status: 400 })
    }

    // Mark onboarding as complete
    const completedAt = new Date()
    const updatedSteps = Array.from(new Set([...existingProgress.completedSteps, 'hello']))

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

    // Update user record to mark onboarding as complete
    if (process.env.NODE_ENV === 'production') {
      await prisma.user.update({
        where: { id: userId },
        data: {
          onboardingCompletedAt: completedAt,
          updatedAt: completedAt
        }
      })
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
export async function GET() {
  try {
    // Authentication
    const token = process.env.NODE_ENV === "development" ? "demo-token" : null // authManager.getTokenFromRequest(request)
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = 'demo-user-id'
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implement proper authentication
      // const session = await authManager.validateToken(token)
      // if (!session?.userId) {
      //   return NextResponse.json(
      //     { error: 'Invalid session' },
      //     { status: 401 }
      //   )
      // }
      // userId = session.userId
      return NextResponse.json(
        { error: 'Authentication not yet implemented' },
        { status: 501 }
      )
    }

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