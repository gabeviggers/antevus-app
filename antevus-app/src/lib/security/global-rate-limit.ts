/**
 * Global Rate Limiting Configuration
 * Provides system-wide rate limiting across all users
 * Uses database-backed implementation for distributed systems
 */

import { logger } from '@/lib/logger'
import { rateLimitRepository } from '@/lib/db/repositories/rate-limit.repository'
import { config, validateEnvironment } from '@/lib/config/env-parser'

// Validate environment on module load
if (process.env.NODE_ENV === 'production') {
  validateEnvironment()
}

// Route configuration type
interface RouteRateLimit {
  key: string
  limit: number
  window: number
  blockDuration: number
}

// Global rate limit configurations using safe parsed values
const globalRateLimits = {
  // Overall system limit - total requests across all users
  system: {
    key: 'global:system',
    limit: config.rateLimits.global,
    window: config.windows.rateLimit,
    blockDuration: 60 * 1000 // Block for 1 minute when exceeded
  },

  // Per-endpoint global limits
  apiEndpoints: {
    key: 'global:api',
    limit: config.rateLimits.globalApi,
    window: config.windows.rateLimit,
    blockDuration: 60 * 1000
  },

  // Authentication endpoint global limit (stricter)
  auth: {
    key: 'global:auth',
    limit: config.rateLimits.globalAuth,
    window: config.windows.rateLimit,
    blockDuration: 5 * 60 * 1000 // Block for 5 minutes
  },

  // Data export global limit
  export: {
    key: 'global:export',
    limit: config.rateLimits.globalExport,
    window: config.windows.rateLimit,
    blockDuration: 10 * 60 * 1000 // Block for 10 minutes
  }
}

// Route-specific rate limit configurations
const routeRateLimits: Map<string, RouteRateLimit> = new Map([
  // Auth routes - strictest limits
  ['/api/auth/login', {
    key: 'route:/api/auth/login',
    limit: 20,
    window: config.windows.rateLimit,
    blockDuration: 15 * 60 * 1000 // 15 minutes
  }],
  ['/api/auth/register', {
    key: 'route:/api/auth/register',
    limit: 10,
    window: config.windows.rateLimit,
    blockDuration: 30 * 60 * 1000 // 30 minutes
  }],
  ['/api/auth/generate-key', {
    key: 'route:/api/auth/generate-key',
    limit: 5,
    window: config.windows.rateLimit,
    blockDuration: 60 * 60 * 1000 // 1 hour
  }],

  // Data export routes - resource-intensive
  ['/api/export', {
    key: 'route:/api/export',
    limit: config.rateLimits.globalExport,
    window: config.windows.rateLimit,
    blockDuration: 10 * 60 * 1000
  }],
  ['/api/backup', {
    key: 'route:/api/backup',
    limit: 5,
    window: config.windows.rateLimit,
    blockDuration: 30 * 60 * 1000
  }],

  // Chat routes - moderate limits for conversation storage
  ['/api/chat/threads', {
    key: 'route:/api/chat/threads',
    limit: 60, // 60 requests per minute for thread operations
    window: config.windows.rateLimit,
    blockDuration: 5 * 60 * 1000 // 5 minutes
  }],

  // Future chat completion endpoint - stricter limits due to LLM costs
  ['/api/chat/completion', {
    key: 'route:/api/chat/completion',
    limit: 30, // 30 requests per minute for LLM calls
    window: config.windows.rateLimit,
    blockDuration: 10 * 60 * 1000 // 10 minutes
  }],

  // Future streaming endpoint - very strict limits
  ['/api/chat/stream', {
    key: 'route:/api/chat/stream',
    limit: 20, // 20 streaming sessions per minute
    window: config.windows.rateLimit,
    blockDuration: 15 * 60 * 1000 // 15 minutes
  }],

  // API v1 routes - moderate limits
  ['/api/v1/instruments', {
    key: 'route:/api/v1/instruments',
    limit: 1000,
    window: config.windows.rateLimit,
    blockDuration: 60 * 1000
  }],
  ['/api/v1/runs', {
    key: 'route:/api/v1/runs',
    limit: 500,
    window: config.windows.rateLimit,
    blockDuration: 60 * 1000
  }],

  // Internal routes
  ['/api/internal', {
    key: 'route:/api/internal',
    limit: 100,
    window: config.windows.rateLimit,
    blockDuration: 5 * 60 * 1000
  }]
])

/**
 * Normalize endpoint path for rate limiting
 * Removes query strings, normalizes IDs, and lowercases
 */
function normalizeEndpoint(endpoint: string): string {
  // Remove query string
  let normalized = endpoint.split('?')[0]

  // Lowercase for consistency
  normalized = normalized.toLowerCase()

  // Replace UUIDs with placeholder
  normalized = normalized.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id'
  )

  // Replace numeric IDs with placeholder
  normalized = normalized.replace(/\/\d+/g, '/:id')

  // Replace common ID patterns
  normalized = normalized.replace(/\/(inst|run|key|user)_[a-zA-Z0-9]+/g, '/:id')

  return normalized
}

/**
 * Get rate limit configuration for an endpoint
 */
function getEndpointRateLimit(endpoint: string): RouteRateLimit {
  const normalized = normalizeEndpoint(endpoint)

  // Check exact match first
  if (routeRateLimits.has(normalized)) {
    return routeRateLimits.get(normalized)!
  }

  // Check prefix matches for grouped routes
  for (const [route, config] of routeRateLimits) {
    if (normalized.startsWith(route)) {
      return config
    }
  }

  // Categorize by path segments for fallback
  if (normalized.includes('/auth/')) {
    return globalRateLimits.auth
  }
  if (normalized.includes('/export') || normalized.includes('/backup')) {
    return globalRateLimits.export
  }

  // Default to general API limits
  return globalRateLimits.apiEndpoints
}

// Track blocked IPs/keys in database for distributed blocking
class DistributedBlockList {
  private readonly BLOCK_KEY_PREFIX = 'blocked:'

  async isBlocked(identifier: string): Promise<boolean> {
    try {
      // Check if identifier is in block list using database
      const blockKey = `${this.BLOCK_KEY_PREFIX}${identifier}`
      // Use a 1 hour window for block checks
      const result = await rateLimitRepository.checkAndConsume(blockKey, 0, 3600000)
      return !result.allowed
    } catch (error) {
      // Use same fail-closed logic for block list checks
      const failOpen = process.env.FAIL_OPEN_RATE_LIMIT === 'true'
      const isDevelopment = process.env.NODE_ENV !== 'production'
      const shouldFailOpen = failOpen && isDevelopment

      logger.error('Failed to check block list', error, {
        identifier,
        failureMode: shouldFailOpen ? 'fail-open' : 'fail-closed',
        decision: shouldFailOpen ? 'NOT BLOCKED (fail-open)' : 'ASSUMED BLOCKED (fail-closed)'
      })

      // In production, assume blocked (fail-closed) for security
      return !shouldFailOpen
    }
  }

  async addToBlockList(identifier: string, durationMs: number): Promise<void> {
    try {
      const blockKey = `${this.BLOCK_KEY_PREFIX}${identifier}`
      // Use rate limit with 0 allowed requests to effectively block
      // Pass the duration as the window to control how long the block lasts
      await rateLimitRepository.checkAndConsume(blockKey, 0, durationMs)
      logger.info('Added to block list', { identifier, durationMs })
    } catch (error) {
      logger.error('Failed to add to block list', error, { identifier })
    }
  }

  async removeFromBlockList(identifier: string): Promise<void> {
    try {
      const blockKey = `${this.BLOCK_KEY_PREFIX}${identifier}`
      // Reset the rate limit to unblock
      await rateLimitRepository.reset(blockKey)
      logger.info('Removed from block list', { identifier })
    } catch (error) {
      logger.error('Failed to remove from block list', error, { identifier })
    }
  }
}

export const blockList = new DistributedBlockList()

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
    // Validate basePoints
    if (isNaN(basePoints) || basePoints <= 0) {
      throw new Error(`Invalid basePoints: ${basePoints}`)
    }
    this.basePoints = Math.floor(basePoints)
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
  config.rateLimits.global
)

export const behaviorRateLimiter = new BehaviorBasedRateLimiter()

/**
 * Check rate limits with flexible configuration
 */
export async function checkRateLimit(
  configOrKey: RouteRateLimit | string,
  identifier?: string
): Promise<{ allowed: boolean; retryAfter?: number; remaining?: number; blocked?: boolean }> {
  // Check if rate limiting is enabled
  if (!config.features.enableRateLimiting) {
    return { allowed: true }
  }

  // Determine configuration
  let limitConfig: RouteRateLimit
  if (typeof configOrKey === 'string') {
    // Legacy support for predefined types
    if (configOrKey in globalRateLimits) {
      limitConfig = globalRateLimits[configOrKey as keyof typeof globalRateLimits]
    } else {
      // Treat as endpoint path
      limitConfig = getEndpointRateLimit(configOrKey)
    }
  } else {
    limitConfig = configOrKey
  }

  try {
    // Check block list first if identifier provided
    if (identifier && await blockList.isBlocked(identifier)) {
      logger.warn('Request blocked by block list', { identifier })
      return { allowed: false, blocked: true, retryAfter: 300 }
    }

    const result = await rateLimitRepository.checkAndConsume(
      limitConfig.key,
      limitConfig.limit,
      limitConfig.window
    )

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)

      // Add to block list if repeatedly hitting limits
      if (identifier && result.remaining < -10) {
        await blockList.addToBlockList(identifier, limitConfig.blockDuration)
      }

      logger.warn('Rate limit exceeded', {
        key: limitConfig.key,
        limit: limitConfig.limit,
        retryAfter,
        remaining: result.remaining
      })

      return { allowed: false, retryAfter, remaining: result.remaining }
    }

    return { allowed: true, remaining: result.remaining }
  } catch (error) {
    // Determine whether to fail open or closed based on environment
    const failOpen = process.env.FAIL_OPEN_RATE_LIMIT === 'true'
    const isDevelopment = process.env.NODE_ENV !== 'production'

    // Only fail open if explicitly enabled AND not in production
    const shouldFailOpen = failOpen && isDevelopment
    const allowed = shouldFailOpen

    logger.error('Rate limit check failed', error, {
      key: limitConfig.key,
      failureMode: allowed ? 'fail-open' : 'fail-closed',
      environment: process.env.NODE_ENV,
      failOpenFlag: failOpen,
      decision: allowed ? 'ALLOWING request due to error (fail-open)' : 'BLOCKING request due to error (fail-closed)'
    })

    // In production, default to fail-closed for security
    // In development, allow fail-open only if explicitly enabled
    return {
      allowed,
      retryAfter: allowed ? undefined : 60
    }
  }
}

/**
 * Check global rate limits (backward compatibility)
 */
export async function checkGlobalRateLimit(
  type: keyof typeof globalRateLimits = 'system',
  identifier?: string
): Promise<{ allowed: boolean; retryAfter?: number; remaining?: number; blocked?: boolean }> {
  return checkRateLimit(type, identifier)
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
export async function checkAdaptiveGlobalLimit(): Promise<{ allowed: boolean; limit: number; error?: string }> {
  try {
    const systemLoad = await getSystemLoad()
    const currentLimit = adaptiveRateLimiter.adjustForLoad(systemLoad)

    const result = await rateLimitRepository.checkAndConsume(
      'adaptive_global',
      currentLimit,
      config.windows.rateLimit
    )

    return { allowed: result.allowed, limit: currentLimit }
  } catch (error) {
    const failOpen = process.env.FAIL_OPEN_RATE_LIMIT === 'true'
    const isDevelopment = process.env.NODE_ENV !== 'production'
    const shouldFailOpen = failOpen && isDevelopment

    logger.error('Adaptive rate limit check failed', error, {
      failureMode: shouldFailOpen ? 'fail-open' : 'fail-closed',
      decision: shouldFailOpen ? 'ALLOWING (fail-open)' : 'BLOCKING (fail-closed)'
    })

    return {
      allowed: shouldFailOpen,
      limit: 0,
      error: 'Adaptive rate limit check failed'
    }
  }
}

/**
 * Combined rate limit check with all strategies
 */
export async function checkCombinedRateLimit(
  userId?: string,
  endpoint?: string,
  ipAddress?: string
): Promise<{
  allowed: boolean
  reason?: string
  retryAfter?: number
  limits?: {
    global: boolean
    adaptive: boolean
    behavior: boolean
    endpoint: boolean
  }
}> {
  const results = {
    global: true,
    adaptive: true,
    behavior: true,
    endpoint: true
  }

  // Check global system limit
  const globalCheck = await checkRateLimit('system', ipAddress)
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
    // Use normalized endpoint-specific rate limiting
    const endpointConfig = getEndpointRateLimit(endpoint)
    const endpointCheck = await checkRateLimit(endpointConfig, ipAddress)
    results.endpoint = endpointCheck.allowed

    if (!endpointCheck.allowed) {
      const normalized = normalizeEndpoint(endpoint)
      return {
        allowed: false,
        reason: `Endpoint rate limit exceeded: ${normalized}`,
        retryAfter: endpointCheck.retryAfter,
        limits: results
      }
    }
  }

  // Check per-user limits if userId provided
  if (userId) {
    const userConfig: RouteRateLimit = {
      key: `user:${userId}`,
      limit: config.rateLimits.perUser,
      window: config.windows.rateLimit,
      blockDuration: 5 * 60 * 1000
    }
    const userCheck = await checkRateLimit(userConfig)

    if (!userCheck.allowed) {
      return {
        allowed: false,
        reason: 'User rate limit exceeded',
        retryAfter: userCheck.retryAfter,
        limits: results
      }
    }
  }

  // Check per-IP limits if IP provided
  if (ipAddress) {
    const ipConfig: RouteRateLimit = {
      key: `ip:${ipAddress}`,
      limit: config.rateLimits.perIp,
      window: config.windows.rateLimit,
      blockDuration: 15 * 60 * 1000
    }
    const ipCheck = await checkRateLimit(ipConfig)

    if (!ipCheck.allowed) {
      return {
        allowed: false,
        reason: 'IP rate limit exceeded',
        retryAfter: ipCheck.retryAfter,
        limits: results
      }
    }
  }

  return {
    allowed: true,
    limits: results
  }
}

// Export utility functions
export { normalizeEndpoint, getEndpointRateLimit }

// Export for monitoring
export function getGlobalRateLimitStats(): {
  system: number
  api: number
  auth: number
  export: number
  adaptive: number
  enabled: boolean
} {
  return {
    system: config.rateLimits.global,
    api: config.rateLimits.globalApi,
    auth: config.rateLimits.globalAuth,
    export: config.rateLimits.globalExport,
    adaptive: adaptiveRateLimiter.getCurrentLimit(),
    enabled: config.features.enableRateLimiting
  }
}

/**
 * Initialize rate limiting system
 */
export async function initializeRateLimiting(): Promise<void> {
  if (!config.features.enableRateLimiting) {
    logger.info('Rate limiting is disabled')
    return
  }

  logger.info('Initializing global rate limiting', getGlobalRateLimitStats())

  // Log configuration at startup
  logger.info('Rate limit configuration:', {
    limits: config.rateLimits,
    windows: config.windows,
    features: config.features
  })
}