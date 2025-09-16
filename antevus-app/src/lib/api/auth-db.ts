/**
 * API Authentication with Database Backend
 * Production-ready authentication using PostgreSQL
 */

import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { auditLogger } from '@/lib/audit/logger'
import { logger } from '@/lib/logger'
import { apiKeyRepository } from '@/lib/db/repositories/api-key.repository'
import { rateLimitRepository } from '@/lib/db/repositories/rate-limit.repository'

export interface APIAuthResult {
  authenticated: boolean
  keyId?: string
  userId?: string
  permissions?: string[]
  rateLimitRemaining?: number
  rateLimitReset?: number
  error?: string
}

// Extract API key from various sources
function extractAPIKey(request: NextRequest): string | null {
  // 1. Check Authorization header (Bearer token)
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  // 2. Check X-API-Key header
  const apiKeyHeader = request.headers.get('x-api-key')
  if (apiKeyHeader) {
    return apiKeyHeader
  }

  // 3. Check query parameter (not recommended for production)
  const url = new URL(request.url)
  const queryKey = url.searchParams.get('api_key')
  if (queryKey) {
    // Remove from URL for security
    url.searchParams.delete('api_key')
    return queryKey
  }

  return null
}

// Get client IP address
function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') || // Cloudflare
    request.headers.get('x-vercel-forwarded-for') || // Vercel
    'unknown'
}

/**
 * Validate API key and check permissions
 * Now uses database for all storage and lookups
 */
export async function validateAPIKey(
  request: NextRequest,
  requiredPermissions: string[] = []
): Promise<APIAuthResult> {
  try {
    // Extract API key from request
    const providedKey = extractAPIKey(request)

    if (!providedKey) {
      await auditLogger.logEvent(
        null,
        'api.auth.failed',
        {
          resourceType: 'api',
          resourceId: request.url,
          success: false,
          errorMessage: 'No API key provided',
          metadata: {
            reason: 'No API key provided',
            ip: getClientIP(request),
            userAgent: request.headers.get('user-agent') || 'unknown'
          }
        }
      )

      return {
        authenticated: false,
        error: 'API key required'
      }
    }

    // Hash the provided key to compare with stored hashes
    const keyHash = crypto.createHash('sha256').update(providedKey).digest('hex')

    // Validate key using database
    const validationResult = await apiKeyRepository.validate(keyHash)

    if (!validationResult.valid || !validationResult.apiKey) {
      await auditLogger.logEvent(
        null,
        'api.auth.failed',
        {
          resourceType: 'api',
          resourceId: request.url,
          success: false,
          errorMessage: validationResult.error || 'Invalid API key',
          metadata: {
            reason: validationResult.error || 'Invalid API key',
            keyHashPrefix: keyHash.substring(0, 8) + '...',
            ip: getClientIP(request)
          }
        }
      )

      return {
        authenticated: false,
        error: validationResult.error || 'Invalid API key'
      }
    }

    const apiKey = validationResult.apiKey

    // Check IP allowlist
    if (apiKey.ipAllowlist && Array.isArray(apiKey.ipAllowlist) && apiKey.ipAllowlist.length > 0) {
      const clientIP = getClientIP(request)
      if (!apiKey.ipAllowlist.includes(clientIP)) {
        await auditLogger.logEvent(
          null,
          'api.auth.failed',
          {
            resourceType: 'api',
            resourceId: request.url,
            success: false,
            errorMessage: 'IP not allowed',
            metadata: {
              userId: apiKey.userId,
              reason: 'IP not allowed',
              keyId: apiKey.id,
              clientIP,
              allowedIPs: apiKey.ipAllowlist
            }
          }
        )

        return {
          authenticated: false,
          error: 'Access denied from this IP address'
        }
      }
    }

    // Check permissions
    const keyPermissions = apiKey.permissions as string[]
    if (requiredPermissions.length > 0) {
      const hasPermissions = requiredPermissions.every(perm =>
        keyPermissions.includes(perm)
      )

      if (!hasPermissions) {
        await auditLogger.logEvent(
          null,
          'api.auth.failed',
          {
            resourceType: 'api',
            resourceId: request.url,
            success: false,
            errorMessage: 'Insufficient permissions',
            metadata: {
              userId: apiKey.userId,
              reason: 'Insufficient permissions',
              keyId: apiKey.id,
              required: requiredPermissions,
              actual: keyPermissions
            }
          }
        )

        return {
          authenticated: false,
          error: 'Insufficient permissions'
        }
      }
    }

    // Check rate limiting with multi-layer approach
    const clientIP = getClientIP(request)
    const rateLimitResult = await rateLimitRepository.checkMultiLayer({
      keyId: apiKey.id,
      keyLimit: apiKey.rateLimit,
      userId: apiKey.userId,
      userLimit: 10000, // 10K requests per minute per user
      ipAddress: clientIP,
      ipLimit: 100 // 100 requests per minute per IP
    })

    if (!rateLimitResult.allowed) {
      await auditLogger.logEvent(
        null,
        'security.rate_limit_exceeded',
        {
          resourceType: 'api',
          resourceId: request.url,
          success: false,
          errorMessage: 'Rate limit exceeded',
          metadata: {
            userId: apiKey.userId,
            keyId: apiKey.id,
            limit: apiKey.rateLimit,
            resetAt: rateLimitResult.resetAt.toISOString(),
            ip: clientIP
          }
        }
      )

      return {
        authenticated: false,
        error: 'Rate limit exceeded',
        rateLimitRemaining: 0,
        rateLimitReset: rateLimitResult.resetAt.getTime()
      }
    }

    // Update usage statistics (async, don't wait)
    apiKeyRepository.updateUsage(apiKey.id).catch(error => {
      logger.error('Failed to update API key usage', error, { keyId: apiKey.id })
    })

    // Log successful authentication
    await auditLogger.logEvent(
      null,
      'api.auth.success',
      {
        resourceType: 'api',
        resourceId: request.url,
        success: true,
        metadata: {
          userId: apiKey.userId,
          keyId: apiKey.id,
          keyName: apiKey.name,
          permissions: keyPermissions,
          rateLimitRemaining: rateLimitResult.remaining,
          ip: getClientIP(request)
        }
      }
    )

    return {
      authenticated: true,
      keyId: apiKey.id,
      userId: apiKey.userId,
      permissions: keyPermissions,
      rateLimitRemaining: rateLimitResult.remaining,
      rateLimitReset: rateLimitResult.resetAt.getTime()
    }

  } catch (error) {
    logger.error('API key validation failed', error)

    await auditLogger.logEvent(
      null,
      'api.auth.failed',
      {
        resourceType: 'api',
        resourceId: request.url,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    )

    return {
      authenticated: false,
      error: 'Authentication failed'
    }
  }
}