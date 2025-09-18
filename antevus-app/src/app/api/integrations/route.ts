import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { getServerSession } from '@/lib/auth/session'
import { auditLogger } from '@/lib/audit/logger'
import { logger } from '@/lib/logger'

// Validation schemas
const IntegrationConfigSchema = z.object({
  projectId: z.string().optional(),
  channel: z.string().optional(),
  workspace: z.string().optional(),
  folder: z.string().optional(),
  syncInterval: z.number().min(60).max(3600).default(300),
  enableNotifications: z.boolean().default(false),
  autoSync: z.boolean().default(false)
})

// Type for stored integration config
interface StoredIntegrationConfig {
  name: string
  status: string
  lastSync: string
  userId: string
  hasCredentials?: boolean  // Only track if credentials exist, never store them here
  syncInterval?: number
  enableNotifications?: boolean
  autoSync?: boolean
  projectId?: string
  channel?: string
  workspace?: string
  folder?: string
}

// Secure storage for integration configs (in production, use encrypted database)
const integrationConfigs = new Map<string, StoredIntegrationConfig>()

// Rate limiting map (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

// CSRF token storage (in production, use secure session storage)
const csrfTokens = new Map<string, { token: string; expiry: number }>()

function generateSecureToken(): string {
  return randomBytes(32).toString('hex')
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const limit = rateLimitMap.get(userId)

  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + 60000 }) // 1 minute window
    return true
  }

  if (limit.count >= 10) { // 10 requests per minute
    return false
  }

  limit.count++
  return true
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(request)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Generate CSRF token for this session
    const csrfToken = generateSecureToken()
    const userId = session.user.id
    csrfTokens.set(userId, { token: csrfToken, expiry: Date.now() + 3600000 }) // 1 hour expiry

    // Return integrations without sensitive data
    const integrations = Array.from(integrationConfigs.entries()).map(([id, config]) => ({
      id,
      name: config.name,
      status: config.status,
      lastSync: config.lastSync,
      // Never send actual credentials to client
      hasCredentials: config.hasCredentials || false
    }))

    return NextResponse.json({
      integrations,
      csrfToken
    }, {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      }
    })
  } catch (error) {
    logger.error('Error fetching integrations', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(request)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check rate limit
    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    // Verify CSRF token
    const csrfToken = request.headers.get('X-CSRF-Token')
    const storedToken = csrfTokens.get(session.user.id)

    if (!csrfToken || !storedToken || csrfToken !== storedToken.token || Date.now() > storedToken.expiry) {
      auditLogger.logEvent(session.user, 'settings.update', {
        resourceType: 'integration',
        success: false,
        errorMessage: 'Invalid CSRF token',
        metadata: {
          action: 'connect',
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
        }
      })
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    }

    const body = await request.json()

    // CRITICAL: Reject any request containing credentials
    const forbiddenFields = ['apiKey', 'webhookUrl', 'secretKey', 'accessToken', 'password', 'secret', 'token', 'credential']
    const requestKeys = Object.keys(body.config || {})
    const hasCredentials = forbiddenFields.some(field =>
      requestKeys.some(key => key.toLowerCase().includes(field.toLowerCase()))
    )

    if (hasCredentials) {
      auditLogger.logEvent(session.user, 'integration.error', {
        resourceType: 'integration',
        success: false,
        errorMessage: 'Credentials rejected at generic endpoint',
        metadata: {
          attemptedFields: requestKeys,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
        }
      })
      return NextResponse.json({
        error: 'Security Error: Credentials must be sent to /api/integrations/[id]/credentials endpoint only',
        details: 'This endpoint does not accept any credential fields. Use the dedicated secure credentials endpoint.'
      }, { status: 400 })
    }

    // Validate input after security check
    const validationResult = IntegrationConfigSchema.safeParse(body.config)

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Invalid configuration',
        details: validationResult.error.flatten()
      }, { status: 400 })
    }

    const { integrationId } = body
    const config = validationResult.data

    // Store non-sensitive configuration only
    integrationConfigs.set(integrationId, {
      name: body.name,
      status: 'connected',
      lastSync: new Date().toISOString(),
      userId: session.user.id,
      hasCredentials: false, // Credentials must be set via dedicated endpoint
      syncInterval: config.syncInterval,
      enableNotifications: config.enableNotifications,
      autoSync: config.autoSync,
      projectId: config.projectId,
      channel: config.channel,
      workspace: config.workspace,
      folder: config.folder
    })

    // Comprehensive audit logging
    auditLogger.logEvent(session.user, 'settings.update', {
      resourceType: 'integration',
      resourceId: integrationId,
      success: true,
      metadata: {
        action: 'connect',
        integrationName: body.name,
        configurationFields: Object.keys(config).filter(k => k !== 'apiKey' && k !== 'webhookUrl'),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        timestamp: new Date().toISOString()
      }
    })

    return NextResponse.json({
      success: true,
      integrationId,
      message: 'Integration configured successfully'
    }, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    })
  } catch (error) {
    logger.error('Error configuring integration', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(request)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check rate limit
    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    // Verify CSRF token
    const csrfToken = request.headers.get('X-CSRF-Token')
    const storedToken = csrfTokens.get(session.user.id)

    if (!csrfToken || !storedToken || csrfToken !== storedToken.token) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const integrationId = searchParams.get('id')

    if (!integrationId) {
      return NextResponse.json({ error: 'Integration ID required' }, { status: 400 })
    }

    const integration = integrationConfigs.get(integrationId)

    if (!integration || integration.userId !== session.user.id) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Remove integration
    integrationConfigs.delete(integrationId)

    // Audit log
    auditLogger.logEvent(session.user, 'settings.update', {
      resourceType: 'integration',
      resourceId: integrationId,
      success: true,
      metadata: {
        action: 'disconnect',
        integrationName: integration.name,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        timestamp: new Date().toISOString()
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Integration disconnected successfully'
    })
  } catch (error) {
    logger.error('Error disconnecting integration', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}