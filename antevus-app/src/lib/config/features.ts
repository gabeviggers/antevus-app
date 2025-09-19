/**
 * Feature Flags Configuration
 *
 * Centralized feature flag management for controlling feature availability
 * across different environments (development, staging, production).
 *
 * SECURITY CONSIDERATIONS:
 * - Features are disabled by default (fail closed)
 * - Demo mode only available in development
 * - Production features require explicit enablement
 * - All feature access is logged for audit purposes
 */

/**
 * Feature flag definitions
 */
export const FEATURES = {
  // Core Features
  onboarding: process.env.ENABLE_ONBOARDING === 'true',
  assistant: process.env.ENABLE_ASSISTANT === 'true',
  apiPlayground: process.env.ENABLE_API_PLAYGROUND === 'true',
  integrations: process.env.ENABLE_INTEGRATIONS === 'true',

  // Security Features
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && process.env.NODE_ENV === 'development',
  csrfProtection: process.env.ENABLE_CSRF_PROTECTION !== 'false', // Enabled by default
  rateLimit: process.env.ENABLE_RATE_LIMIT !== 'false', // Enabled by default

  // Advanced Features
  aiAssistant: process.env.ENABLE_AI_ASSISTANT === 'true',
  automations: process.env.ENABLE_AUTOMATIONS === 'true',
  webhooks: process.env.ENABLE_WEBHOOKS === 'true',

  // Compliance Features
  auditLogging: process.env.ENABLE_AUDIT_LOGGING !== 'false', // Enabled by default
  dataEncryption: process.env.ENABLE_DATA_ENCRYPTION !== 'false', // Enabled by default
  gdprCompliance: process.env.ENABLE_GDPR_COMPLIANCE === 'true',
  hipaaCompliance: process.env.ENABLE_HIPAA_COMPLIANCE === 'true',

  // Development Features
  debugMode: process.env.DEBUG_MODE === 'true' && process.env.NODE_ENV === 'development',
  mockData: process.env.USE_MOCK_DATA === 'true' && process.env.NODE_ENV === 'development',

  // Experimental Features
  betaFeatures: process.env.ENABLE_BETA_FEATURES === 'true',
  alphaFeatures: process.env.ENABLE_ALPHA_FEATURES === 'true' && process.env.NODE_ENV === 'development'
} as const

/**
 * Type-safe feature flag type
 */
export type FeatureFlag = keyof typeof FEATURES

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: FeatureFlag): boolean {
  return FEATURES[feature] ?? false
}

/**
 * Check if multiple features are enabled
 */
export function areFeaturesEnabled(...features: FeatureFlag[]): boolean {
  return features.every(feature => isFeatureEnabled(feature))
}

/**
 * Check if any of the features are enabled
 */
export function isAnyFeatureEnabled(...features: FeatureFlag[]): boolean {
  return features.some(feature => isFeatureEnabled(feature))
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(): FeatureFlag[] {
  return (Object.keys(FEATURES) as FeatureFlag[]).filter(feature => FEATURES[feature])
}

/**
 * Get feature configuration for client-side usage
 * Only returns features safe to expose to the client
 */
export function getClientFeatures() {
  return {
    demoMode: FEATURES.demoMode,
    assistant: FEATURES.assistant,
    apiPlayground: FEATURES.apiPlayground,
    integrations: FEATURES.integrations,
    betaFeatures: FEATURES.betaFeatures,
    gdprCompliance: FEATURES.gdprCompliance,
    hipaaCompliance: FEATURES.hipaaCompliance
  }
}

/**
 * Feature availability check with proper error response
 */
export function checkFeatureAvailability(feature: FeatureFlag): {
  available: boolean
  message?: string
  statusCode?: number
} {
  if (!isFeatureEnabled(feature)) {
    // Provide appropriate error messages based on environment
    if (process.env.NODE_ENV === 'production') {
      return {
        available: false,
        message: 'This feature is not available',
        statusCode: 503 // Service Unavailable
      }
    } else {
      return {
        available: false,
        message: `Feature "${feature}" is disabled. Enable it by setting ENABLE_${feature.toUpperCase()}=true`,
        statusCode: 501 // Not Implemented
      }
    }
  }

  return { available: true }
}

/**
 * Environment-specific feature overrides
 */
export function getEnvironmentFeatures() {
  const env = process.env.NODE_ENV || 'development'

  switch (env) {
    case 'production':
      return {
        // Production-specific overrides
        debugMode: false,
        mockData: false,
        demoMode: false,
        alphaFeatures: false
      }

    case 'test':
      return {
        // Test environment overrides
        mockData: true,
        rateLimit: false,
        csrfProtection: false
      }

    case 'development':
    default:
      return {
        // Development defaults (use environment variables)
      }
  }
}

/**
 * Feature deprecation warnings
 */
export const DEPRECATED_FEATURES: Record<string, { deprecatedIn: string; removeIn: string; alternative?: string }> = {
  // Add deprecated features here as needed
  // Example:
  // oldApiPlayground: {
  //   deprecatedIn: '1.2.0',
  //   removeIn: '2.0.0',
  //   alternative: 'apiPlayground'
  // }
}

/**
 * Check for deprecated feature usage
 */
export function checkDeprecatedFeatures(feature: string): void {
  const deprecation = DEPRECATED_FEATURES[feature]
  if (deprecation) {
    console.warn(
      `⚠️ Feature "${feature}" is deprecated as of version ${deprecation.deprecatedIn} and will be removed in ${deprecation.removeIn}.` +
      (deprecation.alternative ? ` Use "${deprecation.alternative}" instead.` : '')
    )
  }
}