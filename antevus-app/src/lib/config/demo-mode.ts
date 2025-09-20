/**
 * Demo Mode Configuration (Server-only)
 *
 * SECURITY NOTICE:
 * - This module is server-only and should NEVER be imported in client code
 * - Demo mode should only be enabled in development environments
 * - Production deployments must have DEMO_MODE explicitly disabled
 *
 * This centralized helper ensures consistent demo mode checks across all server-side code
 */

/**
 * Check if the application is running in demo mode
 *
 * Demo mode is only enabled when:
 * 1. NODE_ENV is 'development'
 * 2. DEMO_MODE environment variable is explicitly set to 'true'
 *
 * @returns {boolean} True if demo mode is enabled, false otherwise
 */
export function isDemoMode(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true'
}

/**
 * Check if CSRF protection should be enforced
 *
 * CSRF is enforced in production or when not in demo mode
 *
 * @returns {boolean} True if CSRF should be enforced
 */
export function shouldEnforceCSRF(): boolean {
  return process.env.NODE_ENV === 'production' || !isDemoMode()
}

/**
 * Check if we're in production environment
 *
 * @returns {boolean} True if in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Check if we're in development environment
 *
 * @returns {boolean} True if in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development'
}