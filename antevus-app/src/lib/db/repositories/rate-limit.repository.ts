/**
 * Rate Limit Repository - Database-backed rate limiting
 * Replaces in-memory rate limiting with PostgreSQL for distributed systems
 */

import { prisma } from '@/lib/db/prisma'
import { logger } from '@/lib/logger'

export interface RateLimitCheck {
  allowed: boolean
  remaining: number
  resetAt: Date
}

export class RateLimitRepository {
  private defaultWindowDuration = 60000 // 1 minute window in milliseconds (default)

  /**
   * Check and consume rate limit
   * Uses database transaction for atomic operations
   * @param keyId - The rate limit key identifier
   * @param limit - The maximum number of requests allowed in the window
   * @param windowMs - The window duration in milliseconds (optional, defaults to 60000)
   */
  async checkAndConsume(
    keyId: string,
    limit: number,
    windowMs?: number
  ): Promise<RateLimitCheck> {
    const windowDuration = windowMs || this.defaultWindowDuration
    const now = new Date()
    const windowStart = new Date(Math.floor(now.getTime() / windowDuration) * windowDuration)
    const resetAt = new Date(windowStart.getTime() + windowDuration)

    try {
      // Use atomic upsert to prevent race conditions
      const result = await prisma.$transaction(async (tx) => {
        // Atomic upsert: create if not exists, increment if exists
        const rateLimit = await tx.rateLimit.upsert({
          where: {
            keyId_windowStart: {
              keyId,
              windowStart
            }
          },
          create: {
            keyId,
            windowStart,
            requestCount: 1
          },
          update: {
            requestCount: { increment: 1 }
          }
        })

        // Check if limit exceeded (after increment)
        if (rateLimit.requestCount > limit) {
          return {
            allowed: false,
            remaining: Math.max(0, limit - rateLimit.requestCount),
            resetAt
          }
        }

        return {
          allowed: true,
          remaining: limit - rateLimit.requestCount,
          resetAt
        }
      })

      return result
    } catch (error) {
      logger.error('Rate limit check failed', error, { keyId })

      // Use configurable fail-open behavior aligned with global rate limiter
      const failOpen = process.env.FAIL_OPEN_RATE_LIMIT === 'true'
      const isDevelopment = process.env.NODE_ENV !== 'production'
      const shouldFailOpen = failOpen && isDevelopment

      logger.warn('Rate limit database error - applying failure mode', {
        keyId,
        failureMode: shouldFailOpen ? 'fail-open' : 'fail-closed',
        decision: shouldFailOpen ? 'ALLOWING' : 'BLOCKING'
      })

      return {
        allowed: shouldFailOpen,
        remaining: shouldFailOpen ? limit : 0,
        resetAt
      }
    }
  }

  /**
   * Check rate limit for multiple layers (key, user, IP)
   */
  async checkMultiLayer(checks: {
    keyId?: string
    keyLimit?: number
    keyWindow?: number
    userId?: string
    userLimit?: number
    userWindow?: number
    ipAddress?: string
    ipLimit?: number
    ipWindow?: number
  }): Promise<RateLimitCheck> {
    const results: RateLimitCheck[] = []

    // Check each layer with their specific windows
    if (checks.keyId && checks.keyLimit) {
      results.push(await this.checkAndConsume(checks.keyId, checks.keyLimit, checks.keyWindow))
    }

    if (checks.userId && checks.userLimit) {
      results.push(await this.checkAndConsume(`user:${checks.userId}`, checks.userLimit, checks.userWindow))
    }

    if (checks.ipAddress && checks.ipLimit) {
      results.push(await this.checkAndConsume(`ip:${checks.ipAddress}`, checks.ipLimit, checks.ipWindow))
    }

    // Return most restrictive result
    const blocked = results.find(r => !r.allowed)
    if (blocked) return blocked

    // Return result with lowest remaining
    return results.reduce((min, r) =>
      r.remaining < min.remaining ? r : min,
      { allowed: true, remaining: Infinity, resetAt: new Date() }
    )
  }

  /**
   * Reset rate limit for a key (admin operation)
   * @param keyId - The rate limit key identifier
   * @param windowMs - The window duration in milliseconds (optional)
   */
  async reset(keyId: string, windowMs?: number): Promise<void> {
    const windowDuration = windowMs || this.defaultWindowDuration
    const now = new Date()
    const windowStart = new Date(Math.floor(now.getTime() / windowDuration) * windowDuration)

    await prisma.rateLimit.deleteMany({
      where: {
        keyId,
        windowStart
      }
    })
  }

  /**
   * Clean up old rate limit entries
   * Should be run periodically (e.g., every hour)
   * @param windowMs - The window duration to use for cleanup (optional)
   */
  async cleanup(windowMs?: number): Promise<number> {
    const windowDuration = windowMs || this.defaultWindowDuration
    const cutoff = new Date(Date.now() - 2 * windowDuration) // Keep 2 windows

    const result = await prisma.rateLimit.deleteMany({
      where: {
        windowStart: {
          lt: cutoff
        }
      }
    })

    return result.count
  }

  /**
   * Get current usage for a key
   * @param keyId - The rate limit key identifier
   * @param windowMs - The window duration in milliseconds (optional)
   */
  async getCurrentUsage(keyId: string, windowMs?: number): Promise<{
    count: number
    windowStart: Date
    resetAt: Date
  }> {
    const windowDuration = windowMs || this.defaultWindowDuration
    const now = new Date()
    const windowStart = new Date(Math.floor(now.getTime() / windowDuration) * windowDuration)
    const resetAt = new Date(windowStart.getTime() + windowDuration)

    const rateLimit = await prisma.rateLimit.findUnique({
      where: {
        keyId_windowStart: {
          keyId,
          windowStart
        }
      }
    })

    return {
      count: rateLimit?.requestCount || 0,
      windowStart,
      resetAt
    }
  }
}

// Export singleton instance
export const rateLimitRepository = new RateLimitRepository()