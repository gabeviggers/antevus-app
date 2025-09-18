/**
 * Rate Limiting Helper for API Routes
 * Provides easy-to-use rate limiting for Next.js API routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimitRepository } from '@/lib/db/repositories/rate-limit.repository'
import { auditLogger } from '@/lib/security/audit-logger'
import { logger } from '@/lib/logger'

export interface RateLimitConfig {
  key: string
  limit: number
  window?: number // milliseconds, defaults to 60000 (1 minute)
  blockDuration?: number // milliseconds, defaults to 5 minutes
}

export interface RateLimitResult {
  success: boolean
  remaining?: number
  resetAt?: Date
  response?: NextResponse
}

/**
 * Get client identifier for rate limiting
 * Uses IP address or a fallback identifier
 */
async function getClientIdentifier(request: NextRequest): Promise<string> {
  // Try to get real IP from various headers
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwardedFor?.split(',')[0] || realIp || 'unknown'

  // For authenticated requests, we could also use user ID
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    // Extract a consistent identifier from auth token
    // For now, use a hash of the token
    const { createHash } = await import('crypto')
    const hash = createHash('sha256').update(authHeader).digest('hex')
    return `auth:${hash.substring(0, 16)}`
  }

  return `ip:${ip}`
}

/**
 * Check rate limit for a request
 * Returns success status and optionally a response to send if rate limited
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const identifier = await getClientIdentifier(request)
  const rateLimitKey = `${config.key}:${identifier}`

  try {
    // Check and consume rate limit
    const result = await rateLimitRepository.checkAndConsume(
      rateLimitKey,
      config.limit,
      config.window || 60000 // Default to 1 minute window
    )

    if (!result.allowed) {
      // Log rate limit exceeded
      await auditLogger.logSecurityEvent('rateLimit', {
        path: request.url,
        identifier,
        limit: config.limit,
        window: config.window || 60000,
        resetAt: result.resetAt
      })

      logger.warn('Rate limit exceeded', {
        path: request.url,
        identifier,
        limit: config.limit,
        remaining: 0,
        resetAt: result.resetAt
      })

      // Return rate limit response
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)
        },
        { status: 429 }
      )

      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', config.limit.toString())
      response.headers.set('X-RateLimit-Remaining', '0')
      response.headers.set('X-RateLimit-Reset', result.resetAt.toISOString())
      response.headers.set('Retry-After', Math.ceil((result.resetAt.getTime() - Date.now()) / 1000).toString())

      return {
        success: false,
        remaining: 0,
        resetAt: result.resetAt,
        response
      }
    }

    // Rate limit check passed
    return {
      success: true,
      remaining: result.remaining,
      resetAt: result.resetAt
    }

  } catch (error) {
    // Log error but don't block the request (fail open for now)
    logger.error('Rate limit check failed', { error, path: request.url })

    // In production, you might want to fail closed (block request on error)
    // For now, we'll fail open to prevent service disruption
    return {
      success: true,
      remaining: config.limit
    }
  }
}

/**
 * Add rate limit headers to a successful response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
  limit: number
): NextResponse {
  if (result.remaining !== undefined && result.resetAt) {
    response.headers.set('X-RateLimit-Limit', limit.toString())
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
    response.headers.set('X-RateLimit-Reset', result.resetAt.toISOString())
  }
  return response
}

/**
 * Simple rate limit middleware for API routes
 * Usage:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const rateLimited = await withRateLimit(request, {
 *     key: 'api:chat:threads',
 *     limit: 60
 *   })
 *   if (rateLimited) return rateLimited
 *
 *   // Your API logic here
 * }
 * ```
 */
export async function withRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const result = await checkRateLimit(request, config)

  if (!result.success && result.response) {
    return result.response
  }

  return null
}

/**
 * Rate limit configurations for common endpoints
 */
export const RateLimitConfigs = {
  // Chat endpoints
  chatThreads: {
    key: 'api:chat:threads',
    limit: 100, // 100 requests per minute (more permissive for development)
    window: 60000,
    blockDuration: 5 * 60 * 1000
  },
  chatCompletion: {
    key: 'api:chat:completion',
    limit: 30, // 30 requests per minute
    window: 60000,
    blockDuration: 10 * 60 * 1000
  },
  chatStream: {
    key: 'api:chat:stream',
    limit: 20, // 20 streaming sessions per minute
    window: 60000,
    blockDuration: 15 * 60 * 1000
  },

  // Auth endpoints
  authLogin: {
    key: 'api:auth:login',
    limit: 10, // 10 login attempts per minute
    window: 60000,
    blockDuration: 15 * 60 * 1000
  },

  // Export endpoints
  dataExport: {
    key: 'api:export',
    limit: 5, // 5 exports per minute
    window: 60000,
    blockDuration: 10 * 60 * 1000
  }
}