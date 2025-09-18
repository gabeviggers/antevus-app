export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'
export type NotificationChannel = 'toast' | 'inline' | 'desktop' | 'banner'

export interface NotificationAction {
  label: string
  href?: string
  onClick?: () => void
  variant?: 'default' | 'destructive'
}

export interface NotificationOptions {
  id?: string
  severity: NotificationSeverity
  title: string
  description?: string
  actions?: NotificationAction[]
  sticky?: boolean
  ttl?: number // milliseconds
  privacy?: boolean
  source?: string
  correlationId?: string
  coalesce?: boolean
  desktopEnabled?: boolean
  metadata?: Record<string, unknown>
}

export interface Notification extends NotificationOptions {
  id: string
  timestamp: number
  count: number
  dismissed: boolean
}

export interface NotificationPreferences {
  desktopEnabled: boolean
  showPreviews: boolean
  dndStart?: string // "HH:MM"
  dndEnd?: string // "HH:MM"
  soundEnabled: boolean
}

export interface NotificationState {
  notifications: Notification[]
  preferences: NotificationPreferences
  permission: NotificationPermission
}

export interface NotificationStore extends NotificationState {
  notify: (options: NotificationOptions) => string
  dismiss: (id: string) => void
  dismissAll: () => void
  updatePreferences: (prefs: Partial<NotificationPreferences>) => void
  requestPermission: () => Promise<NotificationPermission>
}