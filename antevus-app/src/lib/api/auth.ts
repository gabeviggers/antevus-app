import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { auditLogger } from '@/lib/audit/logger'

// API Key validation and rate limiting

interface APIKey {
  id: string
  userId: string
  name: string
  key: string // Hashed
  prefix: string
  permissions: string[]
  ipAllowlist?: string[]
  rateLimit: number
  createdAt: string
  expiresAt: string | null
  lastUsedAt: string | null
  usageCount: number
  isActive: boolean
}

// Rate limiting storage (in production, use Redis)
interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()
const apiKeyStore = new Map<string, APIKey>() // Shared with generate-key route
const keyHashStore = new Map<string, string>() // hash -> id mapping

// Clean up expired rate limit entries periodically
if (typeof global !== 'undefined' && !global.rateLimitCleanupInterval) {
  global.rateLimitCleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key)
      }
    }
  }, 60000) // Clean up every minute
}

export interface APIAuthResult {
  authenticated: boolean
  keyId?: string
  userId?: string
  permissions?: string[]
  error?: string
  rateLimitRemaining?: number
  rateLimitReset?: number
}

// Extract API key from request
function extractAPIKey(request: NextRequest): string | null {
  // Check Authorization header
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i)
    if (match) {
      return match[1]
    }
  }

  // Check X-API-Key header
  const apiKeyHeader = request.headers.get('x-api-key')
  if (apiKeyHeader) {
    return apiKeyHeader
  }

  // Check query parameter (less secure, log warning)
  const { searchParams } = new URL(request.url)
  const queryKey = searchParams.get('api_key')
  if (queryKey) {
    console.warn('[API Auth] API key passed in query parameter - consider using headers instead')
    return queryKey
  }

  return null
}

// Get client IP address
function getClientIP(request: NextRequest): string {
  return request.ip ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
}

// Check rate limiting
function checkRateLimit(keyId: string, limit: number): {
  allowed: boolean
  remaining: number
  resetAt: number
} {
  const now = Date.now()
  const windowMs = 60000 // 1 minute window
  const resetAt = now + windowMs

  const entry = rateLimitStore.get(keyId)

  if (!entry || entry.resetAt < now) {
    // New window
    rateLimitStore.set(keyId, {
      count: 1,
      resetAt
    })

    return {
      allowed: true,
      remaining: limit - 1,
      resetAt
    }
  }

  if (entry.count >= limit) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt
    }
  }

  // Increment counter
  entry.count++
  rateLimitStore.set(keyId, entry)

  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt
  }
}

// Validate API key
export async function validateAPIKey(
  request: NextRequest,
  requiredPermissions: string[] = []
): Promise<APIAuthResult> {
  try {
    // Extract API key from request
    const providedKey = extractAPIKey(request)

    if (!providedKey) {
      await auditLogger.log({
        type: 'api.auth.failed',
        userId: 'anonymous',
        resourceType: 'api',
        resourceId: request.url,
        success: false,
        metadata: {
          reason: 'No API key provided',
          ip: getClientIP(request),
          userAgent: request.headers.get('user-agent') || 'unknown'
        }
      })

      return {
        authenticated: false,
        error: 'API key required'
      }
    }

    // Hash the provided key to compare with stored hashes
    const keyHash = crypto.createHash('sha256').update(providedKey).digest('hex')

    // Look up the key
    const keyId = keyHashStore.get(keyHash)
    if (!keyId) {
      await auditLogger.log({
        type: 'api.auth.failed',
        userId: 'anonymous',
        resourceType: 'api',
        resourceId: request.url,
        success: false,
        metadata: {
          reason: 'Invalid API key',
          keyPrefix: providedKey.substring(0, 10) + '...',
          ip: getClientIP(request)
        }
      })

      return {
        authenticated: false,
        error: 'Invalid API key'
      }
    }

    const apiKey = apiKeyStore.get(keyId)
    if (!apiKey) {
      return {
        authenticated: false,
        error: 'API key not found'
      }
    }

    // Check if key is active
    if (!apiKey.isActive) {
      await auditLogger.log({
        type: 'api.auth.failed',
        userId: apiKey.userId,
        resourceType: 'api',
        resourceId: request.url,
        success: false,
        metadata: {
          reason: 'API key revoked',
          keyId: apiKey.id,
          ip: getClientIP(request)
        }
      })

      return {
        authenticated: false,
        error: 'API key has been revoked'
      }
    }

    // Check expiration
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      await auditLogger.log({
        type: 'api.auth.failed',
        userId: apiKey.userId,
        resourceType: 'api',
        resourceId: request.url,
        success: false,
        metadata: {
          reason: 'API key expired',
          keyId: apiKey.id,
          expiresAt: apiKey.expiresAt,
          ip: getClientIP(request)
        }
      })

      return {
        authenticated: false,
        error: 'API key has expired'
      }
    }

    // Check IP allowlist
    if (apiKey.ipAllowlist && apiKey.ipAllowlist.length > 0) {
      const clientIP = getClientIP(request)
      if (!apiKey.ipAllowlist.includes(clientIP)) {
        await auditLogger.log({
          type: 'api.auth.failed',
          userId: apiKey.userId,
          resourceType: 'api',
          resourceId: request.url,
          success: false,
          metadata: {
            reason: 'IP not allowed',
            keyId: apiKey.id,
            clientIP,
            allowedIPs: apiKey.ipAllowlist
          }
        })

        return {
          authenticated: false,
          error: 'Access denied from this IP address'
        }
      }
    }

    // Check permissions
    if (requiredPermissions.length > 0) {
      const hasPermissions = requiredPermissions.every(perm =>
        apiKey.permissions.includes(perm)
      )

      if (!hasPermissions) {
        await auditLogger.log({
          type: 'api.auth.failed',
          userId: apiKey.userId,
          resourceType: 'api',
          resourceId: request.url,
          success: false,
          metadata: {
            reason: 'Insufficient permissions',
            keyId: apiKey.id,
            required: requiredPermissions,
            actual: apiKey.permissions
          }
        })

        return {
          authenticated: false,
          error: 'Insufficient permissions'
        }
      }
    }

    // Check rate limiting
    const rateLimitResult = checkRateLimit(apiKey.id, apiKey.rateLimit)

    if (!rateLimitResult.allowed) {
      await auditLogger.log({
        type: 'api.rate_limit_exceeded',
        userId: apiKey.userId,
        resourceType: 'api',
        resourceId: request.url,
        success: false,
        metadata: {
          keyId: apiKey.id,
          limit: apiKey.rateLimit,
          resetAt: new Date(rateLimitResult.resetAt).toISOString()
        }
      })

      return {
        authenticated: false,
        error: 'Rate limit exceeded',
        rateLimitRemaining: 0,
        rateLimitReset: rateLimitResult.resetAt
      }
    }

    // Update usage statistics
    apiKey.lastUsedAt = new Date().toISOString()
    apiKey.usageCount++
    apiKeyStore.set(keyId, apiKey)

    // Log successful authentication
    await auditLogger.log({
      type: 'api.auth.success',
      userId: apiKey.userId,
      resourceType: 'api',
      resourceId: request.url,
      success: true,
      metadata: {
        keyId: apiKey.id,
        keyName: apiKey.name,
        permissions: apiKey.permissions,
        rateLimitRemaining: rateLimitResult.remaining,
        ip: getClientIP(request)
      }
    })

    return {
      authenticated: true,
      keyId: apiKey.id,
      userId: apiKey.userId,
      permissions: apiKey.permissions,
      rateLimitRemaining: rateLimitResult.remaining,
      rateLimitReset: rateLimitResult.resetAt
    }

  } catch (error) {
    console.error('API key validation error:', error)

    await auditLogger.log({
      type: 'api.auth.error',
      userId: 'system',
      resourceType: 'api',
      resourceId: request.url,
      success: false,
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })

    return {
      authenticated: false,
      error: 'Authentication error'
    }
  }
}

// Middleware helper for API routes
export function requireAPIKey(requiredPermissions: string[] = []) {
  return async (request: NextRequest) => {
    const authResult = await validateAPIKey(request, requiredPermissions)

    if (!authResult.authenticated) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        {
          status: authResult.error === 'Rate limit exceeded' ? 429 : 401,
          headers: {
            'Content-Type': 'application/json',
            ...(authResult.rateLimitRemaining !== undefined && {
              'X-RateLimit-Limit': authResult.rateLimitRemaining.toString(),
              'X-RateLimit-Remaining': authResult.rateLimitRemaining.toString(),
              'X-RateLimit-Reset': new Date(authResult.rateLimitReset || 0).toISOString()
            })
          }
        }
      )
    }

    return authResult
  }
}

// Export stores for use in other modules (e.g., generate-key route)
export { apiKeyStore, keyHashStore }