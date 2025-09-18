import { NotificationSeverity } from '@/lib/notifications/types'

export const NOTIFICATION_CONFIG = {
  // Stack configuration
  maxVisible: 4,
  maxQueue: 10,

  // Timing (ms)
  defaultTTL: {
    info: 5000,
    success: 4000,
    warning: 8000,
    error: 0 // sticky by default
  },

  // Coalescing
  coalesceWindow: 10000, // 10 seconds
  coalesceSameSource: true,

  // Rate limiting
  maxPerMinute: 20,
  maxPerSource: 5,

  // Usage thresholds
  usageThresholds: {
    warning: 80,
    critical: 95
  },

  // Desktop notifications
  desktop: {
    defaultDND: {
      start: '22:00',
      end: '07:00'
    },
    allowedSeverities: ['success', 'warning', 'error'] as NotificationSeverity[],
    requireUserAction: ['error'] as NotificationSeverity[]
  },

  // Privacy
  privacyByDefault: false,
  redactInProduction: true,

  // Animation
  animationDuration: 200,
  slideOffset: 100,

  // z-index for toast stack
  zIndex: 9999
}

// Helper to get TTL for severity
export const getTTL = (severity: NotificationSeverity, sticky?: boolean): number => {
  if (sticky) return 0
  return NOTIFICATION_CONFIG.defaultTTL[severity]
}