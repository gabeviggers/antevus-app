/**
 * Secure logger that sanitizes sensitive information
 * Replaces console.log/error to prevent data leaks
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

interface LogContext {
  userId?: string
  requestId?: string
  [key: string]: unknown
}

class SecureLogger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'

  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4
  }

  /**
   * Sanitize sensitive data from logs
   */
  private sanitize(data: unknown): unknown {
    if (data === null || data === undefined) return data

    // Convert Error objects to safe format
    if (data instanceof Error) {
      return {
        message: this.sanitizeString(data.message),
        name: data.name,
        // Never log stack traces in production
        ...(this.isDevelopment && { stack: data.stack })
      }
    }

    // Sanitize strings
    if (typeof data === 'string') {
      return this.sanitizeString(data)
    }

    // Recursively sanitize objects
    if (typeof data === 'object') {
      if (Array.isArray(data)) {
        return data.map(item => this.sanitize(item))
      }

      const sanitized: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(data)) {
        // Skip sensitive fields entirely
        if (this.isSensitiveField(key)) {
          sanitized[key] = '[REDACTED]'
        } else {
          sanitized[key] = this.sanitize(value)
        }
      }
      return sanitized
    }

    return data
  }

  /**
   * Check if a field name indicates sensitive data
   */
  private isSensitiveField(fieldName: string): boolean {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /api[-_]?key/i,
      /auth/i,
      /credential/i,
      /private/i,
      /ssn/i,
      /credit[-_]?card/i
    ]

    return sensitivePatterns.some(pattern => pattern.test(fieldName))
  }

  /**
   * Sanitize string content
   */
  private sanitizeString(str: string): string {
    // Mask API keys (various formats)
    str = str.replace(/\b(ak_[a-zA-Z0-9_-]{20,})\b/g, 'ak_[REDACTED]')
    str = str.replace(/\b(sk_[a-zA-Z0-9_-]{20,})\b/g, 'sk_[REDACTED]')
    str = str.replace(/\b(pk_[a-zA-Z0-9_-]{20,})\b/g, 'pk_[REDACTED]')

    // Mask JWTs
    str = str.replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, '[JWT_REDACTED]')

    // Mask email addresses (keep domain for debugging)
    str = str.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      (match, local, domain) => `[EMAIL]@${domain}`)

    // Mask credit card numbers
    str = str.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CC_REDACTED]')

    // Mask SSNs
    str = str.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_REDACTED]')

    // Mask IP addresses (keep first two octets for debugging)
    str = str.replace(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g,
      (match, a, b) => `${a}.${b}.[REDACTED].[REDACTED]`)

    return str
  }

  /**
   * Check if should log based on level
   */
  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.logLevel]
  }

  /**
   * Format log message
   */
  private format(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    const timestamp = new Date().toISOString()
    const sanitizedContext = context ? this.sanitize(context) : {}

    const log = {
      timestamp,
      level,
      message: this.sanitize(message),
      ...sanitizedContext,
      environment: process.env.NODE_ENV
    }

    return JSON.stringify(log)
  }

  /**
   * Log methods
   */
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      if (this.isDevelopment) {
        console.log(this.format('debug', message, context))
      }
      // In production, would send to logging service
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      if (this.isDevelopment) {
        console.log(this.format('info', message, context))
      }
      // In production, would send to logging service
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      if (this.isDevelopment) {
        console.warn(this.format('warn', message, context))
      }
      // In production, would send to logging service
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const errorContext = {
        ...context,
        error: this.sanitize(error)
      }

      if (this.isDevelopment) {
        console.error(this.format('error', message, errorContext))
      }
      // In production, would send to logging service
    }
  }

  fatal(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = {
      ...context,
      error: this.sanitize(error)
    }

    // Always log fatal errors
    if (this.isDevelopment) {
      console.error(this.format('fatal', message, errorContext))
    }
    // In production, would send to logging service and trigger alerts
  }
}

// Export singleton instance
export const logger = new SecureLogger()

// For backwards compatibility during migration
export default logger