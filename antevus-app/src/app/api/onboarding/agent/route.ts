import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRateLimit } from '@/lib/api/rate-limit-helper'
import { authManager } from '@/lib/security/auth-manager'
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/security/audit-logger'
import { encryptionService } from '@/lib/security/encryption-service'
import { prisma } from '@/lib/database'
import { logger } from '@/lib/logger'

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

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimited = await withRateLimit(request, {
      key: 'api:onboarding:agent',
      limit: 10,
      window: 60000
    })
    if (rateLimited) return rateLimited

    // Authentication - simplified for demo
    // In production, would use: // authManager.getTokenFromRequest(request)
    let userId = 'demo-user-id'

    // For demo mode, skip authentication
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implement proper authentication
      // const token = process.env.NODE_ENV === "development" ? "demo-token" : null // authManager.getTokenFromRequest(request)
      // const session = null // await authManager.validateToken(token)
      return NextResponse.json(
        { error: 'Authentication not yet implemented' },
        { status: 501 }
      )
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

    // Encrypt the agent configuration
    const encryptedAgentData = await encryptionService.encrypt(
      JSON.stringify(agentData)
    )

    // Update onboarding progress
    const progress = await prisma.onboardingProgress.findUnique({
      where: { userId },
      select: { completedSteps: true }
    })

    const currentCompletedSteps = progress?.completedSteps || []
    const updatedSteps = Array.from(new Set([...currentCompletedSteps, 'agent']))

    const onboardingProgress = await prisma.onboardingProgress.update({
      where: { userId },
      data: {
        agentData: encryptedAgentData,
        completedSteps: updatedSteps,
        currentStep: 'endpoints',
        updatedAt: new Date()
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
          .filter(([_, enabled]) => enabled)
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

export async function GET(request: NextRequest) {
  try {
    // Authentication - simplified for demo
    // In production, would use: // authManager.getTokenFromRequest(request)
    let userId = 'demo-user-id'

    // For demo mode, skip authentication
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implement proper authentication
      // const token = process.env.NODE_ENV === "development" ? "demo-token" : null // authManager.getTokenFromRequest(request)
      // const session = null // await authManager.validateToken(token)
      return NextResponse.json(
        { error: 'Authentication not yet implemented' },
        { status: 501 }
      )
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