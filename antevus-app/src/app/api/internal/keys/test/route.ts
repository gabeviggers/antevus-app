/**
 * Server-side API key testing endpoint
 * Tests an API key without exposing it to the client
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth/session'
import { validateAPIKey } from '@/lib/api/auth-db'
import { validateCSRFToken } from '@/lib/security/csrf'
import { auditLogger } from '@/lib/audit/logger'
import { logger } from '@/lib/logger'

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

    // Validate CSRF token for state-changing operations
    const csrfValidation = validateCSRFToken(request, session.user.id, session.user)
    if (!csrfValidation.valid) {
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
            error: csrfValidation.error
          }
        }
      )

      return NextResponse.json(
        { error: csrfValidation.error || 'Invalid CSRF token' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { endpoint, method = 'GET', apiKey } = body

    // Validate required fields
    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'API key required for testing' }, { status: 400 })
    }

    // Validate that the API key belongs to the current user
    // This prevents testing other users' keys
    const keyOwnership = await validateApiKeyOwnership(session.user.id, apiKey)
    if (!keyOwnership.valid) {
      await auditLogger.logEvent(
        session.user,
        'security.unauthorized_access',
        {
          resourceType: 'api_key',
          resourceId: 'test_endpoint',
          success: false,
          errorMessage: 'Attempted to test unauthorized API key',
          metadata: {
            endpoint,
            reason: keyOwnership.reason
          }
        }
      )

      return NextResponse.json(
        { error: 'Unauthorized: API key does not belong to current user' },
        { status: 403 }
      )
    }

    // Create a test request with the provided API key
    // The key is only used for validation, never stored or returned
    const testRequest = new Request(`https://api.antevus.com${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    // Test the API key
    const authResult = await validateAPIKey(testRequest as unknown as NextRequest)

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

      return NextResponse.json({
        success: false,
        error: authResult.error,
        message: 'API key validation failed'
      })
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
 * Validate that an API key belongs to a specific user
 * This checks ownership without exposing stored keys
 */
async function validateApiKeyOwnership(
  userId: string,
  providedKey: string
): Promise<{ valid: boolean; reason?: string }> {
  try {
    // In production, this would:
    // 1. Hash the provided key
    // 2. Query database for user's API keys (stored as hashes)
    // 3. Compare hashes to verify ownership
    // 4. Check key is not revoked/expired
    // 5. NEVER return or expose the stored key

    // For now, validate using the validateAPIKey function
    // which already checks the key hash in the database
    const testRequest = new Request('https://api.antevus.com/test', {
      headers: {
        'Authorization': `Bearer ${providedKey}`
      }
    })

    const authResult = await validateAPIKey(testRequest as unknown as NextRequest)

    if (!authResult.authenticated) {
      return { valid: false, reason: 'Invalid or expired API key' }
    }

    // Verify the key belongs to the requesting user
    if (authResult.userId !== userId) {
      return { valid: false, reason: 'API key does not belong to current user' }
    }

    return { valid: true }
  } catch (error) {
    logger.error('API key ownership validation failed', error, { userId })
    return { valid: false, reason: 'Validation error' }
  }
}