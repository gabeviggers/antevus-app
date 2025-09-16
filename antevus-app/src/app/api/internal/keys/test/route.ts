/**
 * Server-side API key testing endpoint
 * Tests an API key without exposing it to the client
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth/session'
import { validateAPIKey } from '@/lib/api/auth-db'
import { validateCSRFToken } from '@/lib/security/csrf-jwt'
import { auditLogger } from '@/lib/audit/logger'
import { logger } from '@/lib/logger'
import { authorizationService } from '@/lib/auth/authorization'

// Force Node.js runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let session: Awaited<ReturnType<typeof getServerSession>> | null = null

  try {
    // Verify user authentication
    session = await getServerSession(request)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Enforce RBAC - require explicit permission for internal testing
    const canTestKeys = await authorizationService.can({
      user: session.user,
      resource: 'api_key',
      action: 'execute', // Using 'execute' action for testing operations
      resourceData: {
        type: 'internal_test'
      }
    })

    if (!canTestKeys) {
      await auditLogger.logEvent(
        session.user,
        'security.unauthorized_access',
        {
          resourceType: 'api_test',
          resourceId: 'test_endpoint',
          success: false,
          errorMessage: 'Insufficient permissions',
          metadata: {
            endpoint: '/api/internal/keys/test',
            requiredResource: 'api_key',
            requiredAction: 'execute'
          }
        }
      )
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate CSRF token for state-changing operations
    const { valid: csrfValid, error: csrfError } = await validateCSRFToken(
      request,
      session.user.id,
      session.csrfToken || session.user.id, // Use csrfToken as sessionId, fallback to userId
      session.user
    )

    if (!csrfValid) {
      await auditLogger.logEvent(
        session.user,
        'security.csrf_failure',
        {
          resourceType: 'api_test',
          resourceId: 'test_endpoint',
          success: false,
          errorMessage: 'Invalid CSRF token',
          metadata: {
            endpoint: '/api/internal/keys/test',
            reason: 'Invalid CSRF token',
            error: csrfError
          }
        }
      )

      return NextResponse.json(
        { error: csrfError || 'Invalid CSRF token' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { endpoint, method = 'GET' } = body

    // Validate required fields
    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })
    }

    // Restrict which endpoints can be tested
    if (!/^\/api\/v1\//.test(endpoint)) {
      return NextResponse.json({ error: 'Endpoint not allowed for testing' }, { status: 400 })
    }

    // Never accept plaintext API keys from clients in production
    // This endpoint is for testing server-stored keys only
    const storedApiKey = await getUserStoredApiKey(session.user.id)
    if (!storedApiKey) {
      return NextResponse.json(
        { error: 'No API key available for this user' },
        { status: 404 }
      )
    }

    // Create a proper NextRequest that preserves client context
    const url = new URL(`https://api.antevus.com${endpoint}`)
    const headers = new Headers({
      'Authorization': `Bearer ${storedApiKey}`,
      'Content-Type': 'application/json'
    })

    // Preserve client IP and user agent for proper auditing
    const xff = request.headers.get('x-forwarded-for')
      ?? request.headers.get('cf-connecting-ip')
      ?? ''
    if (xff) headers.set('x-forwarded-for', xff)

    const ua = request.headers.get('user-agent')
    if (ua) headers.set('user-agent', ua)

    const testRequest = new NextRequest(url, { method, headers })

    // Test the API key
    const authResult = await validateAPIKey(testRequest)

    if (!authResult.authenticated) {
      await auditLogger.logEvent(
        session.user,
        'api.key.use',
        {
          resourceType: 'api_key',
          resourceId: 'test',
          success: false,
          errorMessage: authResult.error,
          metadata: {
            endpoint,
            method
          }
        }
      )

      const status =
        authResult.error === 'Rate limit exceeded' ? 429 :
        authResult.error === 'Insufficient permissions' ? 403 : 401

      return NextResponse.json(
        {
          success: false,
          error: authResult.error,
          message: 'API key validation failed'
        },
        { status }
      )
    }

    await auditLogger.logEvent(
      session.user,
      'api.key.use',
      {
        resourceType: 'api_key',
        resourceId: authResult.keyId || 'unknown',
        success: true,
        metadata: {
          endpoint,
          method,
          permissions: authResult.permissions,
          rateLimitRemaining: authResult.rateLimitRemaining
        }
      }
    )

    // Return validation result without exposing any key information
    return NextResponse.json({
      success: true,
      message: 'API key validation successful',
      endpoint: endpoint,
      method: method,
      permissions: authResult.permissions,
      rateLimitRemaining: authResult.rateLimitRemaining,
      rateLimitReset: authResult.rateLimitReset
      // Never include the actual API key in the response
    })

  } catch (error) {
    logger.error('API key test failed', error, { userId: session?.user?.id })

    return NextResponse.json(
      { error: 'Failed to test API key' },
      { status: 500 }
    )
  }
}

/**
 * Get user's stored API key from secure server-side storage
 * This retrieves an encrypted key for testing purposes only
 * Never exposes keys to clients
 */
async function getUserStoredApiKey(userId: string): Promise<string | null> {
  try {
    // In production, this would:
    // 1. Query database for user's active API key (encrypted)
    // 2. Decrypt using server-side encryption key
    // 3. Return for internal testing use only
    // 4. NEVER send to client

    // For now, return null to indicate no stored key
    // This forces the endpoint to be non-functional until proper
    // server-side key storage is implemented
    logger.info('API key retrieval requested', { userId })

    // TODO: Implement secure server-side key retrieval
    // const encryptedKey = await apiKeyRepository.getActiveKeyForUser(userId)
    // if (!encryptedKey) return null
    // return await decrypt(encryptedKey, process.env.API_KEY_ENCRYPTION_KEY)

    return null
  } catch (error) {
    logger.error('Failed to retrieve user API key', error, { userId })
    return null
  }
}