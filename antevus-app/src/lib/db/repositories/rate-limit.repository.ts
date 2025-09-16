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
  private windowDuration = 60000 // 1 minute window in milliseconds

  /**
   * Check and consume rate limit
   * Uses database transaction for atomic operations
   */
  async checkAndConsume(
    keyId: string,
    limit: number
  ): Promise<RateLimitCheck> {
    const now = new Date()
    const windowStart = new Date(Math.floor(now.getTime() / this.windowDuration) * this.windowDuration)
    const resetAt = new Date(windowStart.getTime() + this.windowDuration)

    try {
      // Use transaction for atomicity
      const result = await prisma.$transaction(async (tx) => {
        // Find or create rate limit entry for current window
        let rateLimit = await tx.rateLimit.findUnique({
          where: {
            keyId_windowStart: {
              keyId,
              windowStart
            }
          }
        })

        if (!rateLimit) {
          // Create new window
          rateLimit = await tx.rateLimit.create({
            data: {
              keyId,
              windowStart,
              requestCount: 1
            }
          })

          return {
            allowed: true,
            remaining: limit - 1,
            resetAt
          }
        }

        // Check if limit exceeded
        if (rateLimit.requestCount >= limit) {
          return {
            allowed: false,
            remaining: 0,
            resetAt
          }
        }

        // Increment counter
        await tx.rateLimit.update({
          where: {
            id: rateLimit.id
          },
          data: {
            requestCount: { increment: 1 }
          }
        })

        return {
          allowed: true,
          remaining: limit - (rateLimit.requestCount + 1),
          resetAt
        }
      })

      return result
    } catch (error) {
      logger.error('Rate limit check failed', error, { keyId })
      // Fail open in case of database issues (allow request)
      return {
        allowed: true,
        remaining: limit,
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
    userId?: string
    userLimit?: number
    ipAddress?: string
    ipLimit?: number
  }): Promise<RateLimitCheck> {
    const results: RateLimitCheck[] = []

    // Check each layer
    if (checks.keyId && checks.keyLimit) {
      results.push(await this.checkAndConsume(checks.keyId, checks.keyLimit))
    }

    if (checks.userId && checks.userLimit) {
      results.push(await this.checkAndConsume(`user:${checks.userId}`, checks.userLimit))
    }

    if (checks.ipAddress && checks.ipLimit) {
      results.push(await this.checkAndConsume(`ip:${checks.ipAddress}`, checks.ipLimit))
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
   */
  async reset(keyId: string): Promise<void> {
    const now = new Date()
    const windowStart = new Date(Math.floor(now.getTime() / this.windowDuration) * this.windowDuration)

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
   */
  async cleanup(): Promise<number> {
    const cutoff = new Date(Date.now() - 2 * this.windowDuration) // Keep 2 windows

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
   */
  async getCurrentUsage(keyId: string): Promise<{
    count: number
    windowStart: Date
    resetAt: Date
  }> {
    const now = new Date()
    const windowStart = new Date(Math.floor(now.getTime() / this.windowDuration) * this.windowDuration)
    const resetAt = new Date(windowStart.getTime() + this.windowDuration)

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