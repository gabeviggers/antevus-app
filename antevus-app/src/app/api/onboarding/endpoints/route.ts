import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRateLimit } from '@/lib/api/rate-limit-helper'
import { authManager } from '@/lib/security/auth-manager'
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/security/audit-logger'
import { encryptionService } from '@/lib/security/encryption-service'
import { protectWithCSRF } from '@/lib/security/csrf-middleware'
import { prisma } from '@/lib/database'
import { logger } from '@/lib/logger'
import crypto from 'crypto'
import { isDemoMode } from '@/lib/config/demo-mode'

const endpointsSchema = z.object({
  generateApiKey: z.boolean().default(false),
  webhookUrl: z.string().url().optional().nullable(),
  rateLimitTier: z.enum(['basic', 'standard', 'premium']).default('basic'),
  allowedOrigins: z.array(z.string().url()).optional(),
  ipWhitelist: z.array(z.string()).optional()
})

async function handlePOST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimited = await withRateLimit(request, {
      key: 'api:onboarding:endpoints',
      limit: 10,
      window: 60000
    })
    if (rateLimited) return rateLimited

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

    // Parse and validate input
    const body = await request.json()
    const validation = endpointsSchema.safeParse(body)

    if (!validation.success) {
      logger.warn('Invalid endpoints configuration data', {
        errors: validation.error.issues
      })
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.error.issues
      }, { status: 400 })
    }

    const endpointsData = validation.data
    let generatedApiKey = null

    // Generate API key if requested
    if (endpointsData.generateApiKey) {
      // Generate a secure API key
      const keyPrefix = 'ak_live_' // Production keys start with ak_live_
      const randomBytes = crypto.randomBytes(32).toString('hex')
      generatedApiKey = `${keyPrefix}${randomBytes}`

      // In production, store the API key hash in database
      if (process.env.NODE_ENV === 'production') {
        const keyHash = crypto
          .createHash('sha256')
          .update(generatedApiKey)
          .digest('hex')

        // Map tier to rate limit value
        const rateLimitMap = {
          basic: 1000,
          standard: 5000,
          premium: 10000
        }

        await prisma.apiKey.create({
          data: {
            userId,
            name: 'Onboarding API Key',
            keyHash,
            keyPrefix: generatedApiKey.substring(0, 12), // Store prefix for identification
            permissions: ['read:instruments', 'read:runs', 'write:runs'],
            rateLimit: rateLimitMap[endpointsData.rateLimitTier],
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
          }
        })
      }
    }

    // Prepare data for encryption (don't store the actual API key)
    const dataToEncrypt = {
      ...endpointsData,
      apiKeyGenerated: !!generatedApiKey,
      apiKeyPrefix: generatedApiKey ? generatedApiKey.substring(0, 12) : null,
      configuredAt: new Date().toISOString()
    }

    // Encrypt the endpoints configuration
    const encryptedEndpointsData = await encryptionService.encrypt(
      JSON.stringify(dataToEncrypt)
    )

    // Update onboarding progress
    const progress = await prisma.onboardingProgress.findUnique({
      where: { userId },
      select: { completedSteps: true }
    })

    const currentCompletedSteps = progress?.completedSteps || []
    const updatedSteps = Array.from(new Set([...currentCompletedSteps, 'endpoints']))

    const onboardingProgress = await prisma.onboardingProgress.update({
      where: { userId },
      data: {
        endpointsData: encryptedEndpointsData,
        completedSteps: updatedSteps,
        currentStep: 'team',
        updatedAt: new Date()
      }
    })

    // Audit log
    await auditLogger.log({
      eventType: AuditEventType.DATA_ACCESS_GRANTED,
      action: 'onboarding.endpoints.completed',
      userId,
      metadata: {
        step: 'endpoints',
        apiKeyGenerated: !!generatedApiKey,
        rateLimitTier: endpointsData.rateLimitTier,
        hasWebhook: !!endpointsData.webhookUrl,
        hasOriginRestrictions: !!endpointsData.allowedOrigins?.length,
        hasIpWhitelist: !!endpointsData.ipWhitelist?.length
      },
      severity: AuditSeverity.INFO
    })

    logger.info('Onboarding endpoints configuration completed', {
      userId,
      apiKeyGenerated: !!generatedApiKey,
      rateLimitTier: endpointsData.rateLimitTier
    })

    // Prepare response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = {
      success: true,
      nextStep: 'team',
      progress: {
        completedSteps: onboardingProgress.completedSteps.length,
        totalSteps: 5,
        percentComplete: Math.round((onboardingProgress.completedSteps.length / 5) * 100)
      }
    }

    // Include API key only in the response (one-time display)
    if (generatedApiKey) {
      response.apiKey = generatedApiKey
      response.apiKeyMessage = 'Save this API key securely. It will not be shown again.'
    }

    return NextResponse.json(response)

  } catch (error) {
    logger.error('Endpoints API error', error)

    await auditLogger.log({
      eventType: AuditEventType.SYSTEM_ERROR,
      action: 'onboarding.endpoints.error',
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

async function handleGET(request: NextRequest) {
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
        endpointsData: null,
        currentStep: 'endpoints',
        completedSteps: []
      })
    }

    // Retrieve onboarding progress
    const progress = await prisma.onboardingProgress.findUnique({
      where: { userId },
      select: {
        endpointsData: true,
        completedSteps: true,
        currentStep: true
      }
    })

    if (!progress?.endpointsData) {
      return NextResponse.json({
        endpointsData: null,
        currentStep: progress?.currentStep || 'endpoints',
        completedSteps: progress?.completedSteps || []
      })
    }

    // Decrypt the endpoints data
    const decryptedData = await encryptionService.decrypt(progress.endpointsData)
    const endpointsData = JSON.parse(decryptedData)

    // Don't send sensitive data back to client
    const sanitizedData = {
      apiKeyGenerated: endpointsData.apiKeyGenerated,
      apiKeyPrefix: endpointsData.apiKeyPrefix,
      rateLimitTier: endpointsData.rateLimitTier,
      hasWebhook: !!endpointsData.webhookUrl,
      configuredAt: endpointsData.configuredAt
    }

    return NextResponse.json({
      endpointsData: sanitizedData,
      currentStep: progress.currentStep,
      completedSteps: progress.completedSteps
    })

  } catch (error) {
    logger.error('Failed to retrieve endpoints data', error)
    return NextResponse.json(
      { error: 'Failed to retrieve endpoints data' },
      { status: 500 }
    )
  }
}

// Export handlers with CSRF protection for POST
export const { POST } = protectWithCSRF({ POST: handlePOST })
export { handleGET as GET }