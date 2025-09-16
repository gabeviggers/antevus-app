/**
 * Safe Environment Variable Parser
 * Provides type-safe parsing with validation and sensible defaults
 */

import { logger } from '@/lib/logger'

export interface NumberOptions {
  min?: number
  max?: number
  fallback: number
}

export interface StringOptions {
  allowEmpty?: boolean
  pattern?: RegExp
  fallback: string
}

/**
 * Parse a number from environment variable with validation
 */
export function numberFromEnv(
  key: string,
  options: NumberOptions
): number {
  const { min = 0, max = Number.MAX_SAFE_INTEGER, fallback } = options
  const rawValue = process.env[key]

  if (!rawValue) {
    logger.debug(`Environment variable ${key} not set, using fallback: ${fallback}`)
    return fallback
  }

  // Parse with explicit radix
  const parsed = parseInt(rawValue, 10)

  // Check for invalid parse
  if (isNaN(parsed)) {
    logger.warn(`Invalid number in ${key}: "${rawValue}", using fallback: ${fallback}`)
    return fallback
  }

  // Validate range
  if (parsed < min) {
    logger.warn(`${key} value ${parsed} below minimum ${min}, clamping to ${min}`)
    return min
  }

  if (parsed > max) {
    logger.warn(`${key} value ${parsed} above maximum ${max}, clamping to ${max}`)
    return max
  }

  return parsed
}

/**
 * Parse a float from environment variable with validation
 */
export function floatFromEnv(
  key: string,
  options: NumberOptions
): number {
  const { min = 0, max = Number.MAX_SAFE_INTEGER, fallback } = options
  const rawValue = process.env[key]

  if (!rawValue) {
    logger.debug(`Environment variable ${key} not set, using fallback: ${fallback}`)
    return fallback
  }

  const parsed = parseFloat(rawValue)

  if (isNaN(parsed)) {
    logger.warn(`Invalid float in ${key}: "${rawValue}", using fallback: ${fallback}`)
    return fallback
  }

  // Validate range
  if (parsed < min) {
    logger.warn(`${key} value ${parsed} below minimum ${min}, clamping to ${min}`)
    return min
  }

  if (parsed > max) {
    logger.warn(`${key} value ${parsed} above maximum ${max}, clamping to ${max}`)
    return max
  }

  return parsed
}

/**
 * Parse a boolean from environment variable
 */
export function booleanFromEnv(
  key: string,
  fallback: boolean = false
): boolean {
  const rawValue = process.env[key]

  if (!rawValue) {
    return fallback
  }

  const normalized = rawValue.toLowerCase().trim()

  // Explicit true values
  if (['true', '1', 'yes', 'on', 'enabled'].includes(normalized)) {
    return true
  }

  // Explicit false values
  if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) {
    return false
  }

  logger.warn(`Invalid boolean in ${key}: "${rawValue}", using fallback: ${fallback}`)
  return fallback
}

/**
 * Parse a string from environment variable with validation
 */
export function stringFromEnv(
  key: string,
  options: StringOptions
): string {
  const { allowEmpty = false, pattern, fallback } = options
  const rawValue = process.env[key]

  if (!rawValue) {
    logger.debug(`Environment variable ${key} not set, using fallback: ${fallback}`)
    return fallback
  }

  const trimmed = rawValue.trim()

  if (!allowEmpty && trimmed.length === 0) {
    logger.warn(`Empty string in ${key}, using fallback: ${fallback}`)
    return fallback
  }

  if (pattern && !pattern.test(trimmed)) {
    logger.warn(`${key} value "${trimmed}" doesn't match pattern ${pattern}, using fallback: ${fallback}`)
    return fallback
  }

  return trimmed
}

/**
 * Parse a duration string (e.g., "5m", "1h", "30s") to milliseconds
 */
export function durationFromEnv(
  key: string,
  fallbackMs: number
): number {
  const rawValue = process.env[key]

  if (!rawValue) {
    return fallbackMs
  }

  const match = rawValue.match(/^(\d+)(ms|s|m|h|d)$/i)

  if (!match) {
    logger.warn(`Invalid duration format in ${key}: "${rawValue}", using fallback: ${fallbackMs}ms`)
    return fallbackMs
  }

  const value = parseInt(match[1], 10)
  const unit = match[2].toLowerCase()

  if (isNaN(value) || value < 0) {
    logger.warn(`Invalid duration value in ${key}: "${rawValue}", using fallback: ${fallbackMs}ms`)
    return fallbackMs
  }

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  }

  return value * multipliers[unit]
}

/**
 * Validate all critical environment variables at startup
 */
export function validateEnvironment(): void {
  const errors: string[] = []

  // Check required variables
  const required = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'CSRF_SECRET',
    'API_KEY_ENCRYPTION_KEY',
    'AUDIT_SIGNING_KEY'
  ]

  if (process.env.NODE_ENV === 'production') {
    for (const key of required) {
      if (!process.env[key]) {
        errors.push(`Missing required environment variable: ${key}`)
      }
    }

    // Validate secret lengths
    const secrets = ['SESSION_SECRET', 'CSRF_SECRET', 'API_KEY_ENCRYPTION_KEY', 'AUDIT_SIGNING_KEY']
    for (const key of secrets) {
      const value = process.env[key]
      if (value && value.length < 32) {
        errors.push(`${key} must be at least 32 characters long`)
      }
    }

    // Validate API key encryption key format
    const apiKeyEncKey = process.env.API_KEY_ENCRYPTION_KEY
    if (apiKeyEncKey && !/^[0-9a-fA-F]{64}$/.test(apiKeyEncKey)) {
      errors.push('API_KEY_ENCRYPTION_KEY must be a 64-character hex string')
    }
  }

  // Log errors and optionally fail
  if (errors.length > 0) {
    logger.error('Environment validation errors:', { errors })

    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Environment validation failed:\n${errors.join('\n')}`)
    }
  }

  logger.info('Environment validation successful')
}

/**
 * Get configuration with safe defaults
 */
export const config = {
  // Rate limiting
  rateLimits: {
    global: numberFromEnv('GLOBAL_RATE_LIMIT', { min: 100, max: 100000, fallback: 10000 }),
    globalApi: numberFromEnv('GLOBAL_API_LIMIT', { min: 50, max: 50000, fallback: 5000 }),
    globalAuth: numberFromEnv('GLOBAL_AUTH_LIMIT', { min: 10, max: 1000, fallback: 100 }),
    globalExport: numberFromEnv('GLOBAL_EXPORT_LIMIT', { min: 5, max: 500, fallback: 50 }),
    perUser: numberFromEnv('USER_RATE_LIMIT', { min: 10, max: 10000, fallback: 1000 }),
    perIp: numberFromEnv('IP_RATE_LIMIT', { min: 10, max: 5000, fallback: 100 })
  },

  // Timeouts and windows
  windows: {
    rateLimit: durationFromEnv('RATE_LIMIT_WINDOW', 60000), // Default: 1 minute
    session: durationFromEnv('SESSION_DURATION', 24 * 60 * 60 * 1000), // Default: 24 hours
    csrfToken: durationFromEnv('CSRF_TOKEN_DURATION', 60 * 60 * 1000) // Default: 1 hour
  },

  // Feature flags
  features: {
    doubleSubmitCsrf: booleanFromEnv('ENABLE_DOUBLE_SUBMIT', false),
    allowMockUsers: booleanFromEnv('ALLOW_MOCK_USERS', false),
    enableAuditLogging: booleanFromEnv('ENABLE_AUDIT_LOGGING', true),
    enableEncryption: booleanFromEnv('ENABLE_ENCRYPTION', true),
    enableRateLimiting: booleanFromEnv('ENABLE_RATE_LIMITING', true),
    failOpenRateLimit: booleanFromEnv('FAIL_OPEN_RATE_LIMIT', false) // NEVER enable in production
  },

  // External services
  services: {
    siemEndpoint: stringFromEnv('SIEM_ENDPOINT', { fallback: '' }),
    siemApiKey: stringFromEnv('SIEM_API_KEY', { fallback: '' }),
    redisUrl: stringFromEnv('REDIS_URL', { fallback: '' })
  }
}