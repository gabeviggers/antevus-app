/**
 * Global Rate Limiting Configuration
 * Provides system-wide rate limiting across all users
 */

import { logger } from '@/lib/logger'
import { rateLimitRepository } from '@/lib/db/repositories/rate-limit.repository'

// Global rate limit configurations
const globalRateLimits = {
  // Overall system limit - total requests across all users
  system: {
    key: 'global_system',
    limit: parseInt(process.env.GLOBAL_RATE_LIMIT || '10000'),
    window: 60 * 1000 // 1 minute in milliseconds
  },

  // Per-endpoint global limits
  apiEndpoints: {
    key: 'global_api',
    limit: parseInt(process.env.GLOBAL_API_LIMIT || '5000'),
    window: 60 * 1000
  },

  // Authentication endpoint global limit (stricter)
  auth: {
    key: 'global_auth',
    limit: parseInt(process.env.GLOBAL_AUTH_LIMIT || '100'),
    window: 60 * 1000
  },

  // Data export global limit
  export: {
    key: 'global_export',
    limit: parseInt(process.env.GLOBAL_EXPORT_LIMIT || '50'),
    window: 60 * 1000
  }
}

// Adaptive rate limiting based on system load
class AdaptiveRateLimiter {
  private basePoints: number
  private currentMultiplier: number = 1
  private loadThresholds = {
    low: 0.3,
    medium: 0.6,
    high: 0.8,
    critical: 0.95
  }

  constructor(basePoints: number) {
    this.basePoints = basePoints
  }

  /**
   * Adjust rate limits based on system load
   */
  adjustForLoad(currentLoad: number): number {
    if (currentLoad < this.loadThresholds.low) {
      this.currentMultiplier = 1.2 // Allow 20% more during low load
    } else if (currentLoad < this.loadThresholds.medium) {
      this.currentMultiplier = 1.0 // Normal rate
    } else if (currentLoad < this.loadThresholds.high) {
      this.currentMultiplier = 0.7 // Reduce by 30% during high load
    } else if (currentLoad < this.loadThresholds.critical) {
      this.currentMultiplier = 0.4 // Reduce by 60% during critical load
    } else {
      this.currentMultiplier = 0.1 // Emergency throttling
    }

    return Math.floor(this.basePoints * this.currentMultiplier)
  }

  getCurrentLimit(): number {
    return Math.floor(this.basePoints * this.currentMultiplier)
  }
}

// User behavior-based rate limiting
interface UserBehavior {
  requestCount: number
  errorRate: number
  lastActivity: Date
  suspiciousActivity: boolean
  reputation: number // 0-100
}

class BehaviorBasedRateLimiter {
  private userBehaviors: Map<string, UserBehavior> = new Map()

  /**
   * Calculate rate limit multiplier based on user behavior
   */
  getUserMultiplier(userId: string): number {
    const behavior = this.userBehaviors.get(userId)

    if (!behavior) {
      return 1.0 // Default for new users
    }

    let multiplier = 1.0

    // Adjust based on reputation
    if (behavior.reputation >= 80) {
      multiplier *= 1.5 // Trusted users get 50% more
    } else if (behavior.reputation >= 60) {
      multiplier *= 1.2
    } else if (behavior.reputation < 30) {
      multiplier *= 0.5 // Reduce for low reputation
    }

    // Penalize high error rates
    if (behavior.errorRate > 0.5) {
      multiplier *= 0.3
    } else if (behavior.errorRate > 0.2) {
      multiplier *= 0.7
    }

    // Penalize suspicious activity
    if (behavior.suspiciousActivity) {
      multiplier *= 0.2
    }

    return Math.max(0.1, Math.min(2.0, multiplier)) // Cap between 0.1x and 2x
  }

  /**
   * Update user behavior metrics
   */
  updateUserBehavior(
    userId: string,
    success: boolean,
    suspicious: boolean = false
  ): void {
    const behavior = this.userBehaviors.get(userId) || {
      requestCount: 0,
      errorRate: 0,
      lastActivity: new Date(),
      suspiciousActivity: false,
      reputation: 50
    }

    behavior.requestCount++
    behavior.lastActivity = new Date()

    // Update error rate (exponential moving average)
    const errorWeight = 0.1
    behavior.errorRate = behavior.errorRate * (1 - errorWeight) +
                         (success ? 0 : 1) * errorWeight

    // Update reputation
    if (success && !suspicious) {
      behavior.reputation = Math.min(100, behavior.reputation + 0.1)
    } else if (!success) {
      behavior.reputation = Math.max(0, behavior.reputation - 1)
    }

    if (suspicious) {
      behavior.suspiciousActivity = true
      behavior.reputation = Math.max(0, behavior.reputation - 10)
    }

    this.userBehaviors.set(userId, behavior)

    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      this.cleanupOldBehaviors()
    }
  }

  private cleanupOldBehaviors(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000 // 24 hours

    for (const [userId, behavior] of this.userBehaviors.entries()) {
      if (behavior.lastActivity.getTime() < cutoff) {
        this.userBehaviors.delete(userId)
      }
    }
  }
}

// Export instances
export const adaptiveRateLimiter = new AdaptiveRateLimiter(
  parseInt(process.env.GLOBAL_RATE_LIMIT || '10000')
)

export const behaviorRateLimiter = new BehaviorBasedRateLimiter()

/**
 * Check global rate limits
 */
export async function checkGlobalRateLimit(
  type: keyof typeof globalRateLimits = 'system'
): Promise<{ allowed: boolean; retryAfter?: number; remaining?: number }> {
  try {
    const config = globalRateLimits[type]
    const result = await rateLimitRepository.checkAndConsume(
      config.key,
      config.limit
    )

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)
      logger.warn('Global rate limit exceeded', {
        type,
        retryAfter,
        remaining: result.remaining
      })
      return { allowed: false, retryAfter, remaining: result.remaining }
    }

    return { allowed: true, remaining: result.remaining }
  } catch (error) {
    logger.error('Global rate limit check failed', error)
    return { allowed: true } // Fail open in case of error
  }
}

/**
 * Get current system load (placeholder - implement based on your metrics)
 */
export async function getSystemLoad(): Promise<number> {
  // In production, this would query actual system metrics
  // For now, return a simulated value
  return 0.5
}

/**
 * Apply adaptive global rate limiting
 */
export async function checkAdaptiveGlobalLimit(): Promise<{ allowed: boolean; limit: number }> {
  const systemLoad = await getSystemLoad()
  const currentLimit = adaptiveRateLimiter.adjustForLoad(systemLoad)

  const result = await rateLimitRepository.checkAndConsume(
    'adaptive_global',
    currentLimit
  )

  return { allowed: result.allowed, limit: currentLimit }
}

/**
 * Combined rate limit check with all strategies
 */
export async function checkCombinedRateLimit(
  userId?: string,
  endpoint?: string
): Promise<{
  allowed: boolean
  reason?: string
  retryAfter?: number
  limits?: {
    global: boolean
    adaptive: boolean
    behavior: boolean
  }
}> {
  const results = {
    global: true,
    adaptive: true,
    behavior: true
  }

  // Check global system limit
  const globalCheck = await checkGlobalRateLimit('system')
  results.global = globalCheck.allowed

  if (!globalCheck.allowed) {
    return {
      allowed: false,
      reason: 'Global rate limit exceeded',
      retryAfter: globalCheck.retryAfter,
      limits: results
    }
  }

  // Check adaptive limit based on load
  const adaptiveCheck = await checkAdaptiveGlobalLimit()
  results.adaptive = adaptiveCheck.allowed

  if (!adaptiveCheck.allowed) {
    return {
      allowed: false,
      reason: 'System under high load',
      retryAfter: 60,
      limits: results
    }
  }

  // Check endpoint-specific limits if provided
  if (endpoint) {
    let endpointType: keyof typeof globalRateLimits = 'apiEndpoints'

    if (endpoint.includes('auth')) {
      endpointType = 'auth'
    } else if (endpoint.includes('export')) {
      endpointType = 'export'
    }

    const endpointCheck = await checkGlobalRateLimit(endpointType)

    if (!endpointCheck.allowed) {
      return {
        allowed: false,
        reason: `Endpoint rate limit exceeded: ${endpointType}`,
        retryAfter: endpointCheck.retryAfter,
        limits: results
      }
    }
  }

  return {
    allowed: true,
    limits: results
  }
}

// Export for monitoring
export function getGlobalRateLimitStats(): {
  system: number
  api: number
  auth: number
  export: number
  adaptive: number
} {
  return {
    system: parseInt(process.env.GLOBAL_RATE_LIMIT || '10000'),
    api: parseInt(process.env.GLOBAL_API_LIMIT || '5000'),
    auth: parseInt(process.env.GLOBAL_AUTH_LIMIT || '100'),
    export: parseInt(process.env.GLOBAL_EXPORT_LIMIT || '50'),
    adaptive: adaptiveRateLimiter.getCurrentLimit()
  }
}