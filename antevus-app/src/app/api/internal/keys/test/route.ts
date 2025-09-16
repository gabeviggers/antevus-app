/**
 * Server-side API key testing endpoint
 * Tests an API key without exposing it to the client
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth/session'
import { validateAPIKey } from '@/lib/api/auth'
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

    const body = await request.json()
    const { endpoint, method = 'GET' } = body

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })
    }

    // Create a mock request with the API key from session/storage
    // Never accept API keys from the client
    const testRequest = new Request(`https://api.antevus.com${endpoint}`, {
      method,
      headers: {
        // Get the user's stored API key from secure storage
        // This is a placeholder - in production, fetch from secure database
        'Authorization': `Bearer ${await getUserStoredApiKey(session.user.id)}`,
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

    return NextResponse.json({
      success: true,
      message: 'API key is valid',
      permissions: authResult.permissions,
      rateLimitRemaining: authResult.rateLimitRemaining,
      rateLimitReset: authResult.rateLimitReset
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
 * Get user's stored API key from secure storage
 * In production, this would fetch from encrypted database
 */
async function getUserStoredApiKey(userId: string): Promise<string> {
  // This is a placeholder function
  // In production:
  // 1. Query database for user's active API key
  // 2. Decrypt if necessary
  // 3. Return the key for internal use only
  // 4. NEVER send to client

  return 'placeholder_key'
}