import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRateLimit } from '@/lib/api/rate-limit-helper'
import { authManager } from '@/lib/security/auth-manager'
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/security/audit-logger'
import { encryptionService } from '@/lib/security/encryption-service'
import { prisma } from '@/lib/database'
import { logger } from '@/lib/logger'
import { isDemoMode } from '@/lib/config/demo-mode'
import { protectWithCSRF } from '@/lib/security/csrf-middleware'

const agentSchema = z.object({
  enableAutomation: z.boolean().default(false),
  enableAI: z.boolean().default(false),
  automationLevel: z.enum(['basic', 'advanced', 'expert']).default('basic'),
  notifications: z.object({
    email: z.boolean().default(true),
    slack: z.boolean().default(false),
    webhook: z.boolean().default(false)
  }),
  preferences: z.object({
    autoRetry: z.boolean().default(true),
    maxRetries: z.number().min(1).max(5).default(3),
    timeoutSeconds: z.number().min(30).max(600).default(120),
    queuePriority: z.enum(['low', 'normal', 'high']).default('normal')
  })
})

async function handlePOST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimited = await withRateLimit(request, {
      key: 'api:onboarding:agent',
      limit: 10,
      window: 60000
    })
    if (rateLimited) return rateLimited

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

    // Parse and validate input
    const body = await request.json()
    const validation = agentSchema.safeParse(body)

    if (!validation.success) {
      logger.warn('Invalid agent configuration data', {
        errors: validation.error.issues
      })
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.error.issues
      }, { status: 400 })
    }

    const agentData = validation.data

    // For demo mode, return success without database operations
    if (isDemoMode()) {
      logger.info('Demo agent configuration completed', {
        userId,
        automationEnabled: agentData.enableAutomation,
        aiEnabled: agentData.enableAI
      })

      return NextResponse.json({
        success: true,
        nextStep: 'endpoints',
        progress: {
          completedSteps: 3,
          totalSteps: 5,
          percentComplete: 60
        }
      })
    }

    // Encrypt the agent configuration
    const encryptedAgentData = await encryptionService.encrypt(
      JSON.stringify(agentData)
    )

    // CSRF validation is now handled by the middleware

    // Update onboarding progress (create if missing)
    const existing = await prisma.onboardingProgress.findUnique({
      where: { userId },
      select: { completedSteps: true }
    })

    const currentCompletedSteps = existing?.completedSteps || []
    const updatedSteps = Array.from(new Set([...currentCompletedSteps, 'agent']))

    const onboardingProgress = await prisma.onboardingProgress.upsert({
      where: { userId },
      update: {
        agentData: encryptedAgentData,
        completedSteps: updatedSteps,
        currentStep: 'endpoints',
        updatedAt: new Date()
      },
      create: {
        userId,
        agentData: encryptedAgentData,
        completedSteps: updatedSteps,
        currentStep: 'endpoints'
      }
    })
    // Audit log
    await auditLogger.log({
      eventType: AuditEventType.DATA_ACCESS_GRANTED,
      action: 'onboarding.agent.completed',
      userId,
      metadata: {
        step: 'agent',
        enableAutomation: agentData.enableAutomation,
        enableAI: agentData.enableAI,
        automationLevel: agentData.automationLevel,
        notificationChannels: Object.entries(agentData.notifications)
          .filter(([, enabled]) => enabled)
          .map(([channel]) => channel)
      },
      severity: AuditSeverity.INFO
    })

    logger.info('Onboarding agent configuration completed', {
      userId,
      automationEnabled: agentData.enableAutomation,
      aiEnabled: agentData.enableAI
    })

    return NextResponse.json({
      success: true,
      nextStep: 'endpoints',
      progress: {
        completedSteps: onboardingProgress.completedSteps.length,
        totalSteps: 5,
        percentComplete: Math.round((onboardingProgress.completedSteps.length / 5) * 100)
      }
    })

  } catch (error) {
    logger.error('Agent API error', error)

    await auditLogger.log({
      eventType: AuditEventType.SYSTEM_ERROR,
      action: 'onboarding.agent.error',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      severity: AuditSeverity.ERROR
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const { POST } = protectWithCSRF({ POST: handlePOST })

export async function GET(request: Request) {
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

    // For demo mode, return empty data
    if (isDemoMode()) {
      return NextResponse.json({
        agentData: null,
        currentStep: 'agent',
        completedSteps: []
      })
    }

    // Retrieve onboarding progress
    const progress = await prisma.onboardingProgress.findUnique({
      where: { userId },
      select: {
        agentData: true,
        completedSteps: true,
        currentStep: true
      }
    })

    if (!progress?.agentData) {
      return NextResponse.json({
        agentData: null,
        currentStep: progress?.currentStep || 'agent',
        completedSteps: progress?.completedSteps || []
      })
    }

    // Decrypt the agent data
    const decryptedData = await encryptionService.decrypt(progress.agentData)
    const agentData = JSON.parse(decryptedData)

    return NextResponse.json({
      agentData,
      currentStep: progress.currentStep,
      completedSteps: progress.completedSteps
    })

  } catch (error) {
    logger.error('Failed to retrieve agent data', error)
    return NextResponse.json(
      { error: 'Failed to retrieve agent data' },
      { status: 500 }
    )
  }
}