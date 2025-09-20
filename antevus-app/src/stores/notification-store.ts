import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  NotificationOptions,
  Notification,
  NotificationStore,
  NotificationPreferences
} from '@/lib/notifications/types'
import { NOTIFICATION_CONFIG, getTTL } from '@/config/notifications'
import { createRateLimiter } from '@/lib/notifications/security'
import {
  sendDesktopNotification,
  isInDNDWindow,
  requestDesktopPermission
} from '@/lib/notifications/desktop'
import { logger } from '@/lib/logger'

// Create rate limiter
const rateLimiter = createRateLimiter(
  NOTIFICATION_CONFIG.maxPerMinute,
  NOTIFICATION_CONFIG.maxPerSource
)

// Create the store
export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      notifications: [],
      preferences: {
        desktopEnabled: false,
        showPreviews: true,
        soundEnabled: true,
        dndStart: '22:00',
        dndEnd: '07:00'
      },
      permission: 'default',

      notify: (options: NotificationOptions) => {
        const state = get()
        const now = Date.now()
        const id = options.id || `${options.source || 'system'}-${now}-${Math.random()}`

        // Check rate limiting
        if (!rateLimiter(options.source)) {
          if (process.env.NODE_ENV !== 'production') {
            logger.warn('Notification rate limit exceeded', { source: options.source })
          }
          return id
        }

        // Check for coalescing
        if (options.coalesce !== false && options.source) {
          const existing = state.notifications.find(n =>
            !n.dismissed &&
            n.title === options.title &&
            n.source === options.source &&
            n.correlationId === options.correlationId &&
            (now - n.timestamp) < NOTIFICATION_CONFIG.coalesceWindow
          )

          if (existing) {
            // Increment count instead of creating new
            set(state => ({
              notifications: state.notifications.map(n =>
                n.id === existing.id
                  ? { ...n, count: n.count + 1, timestamp: now }
                  : n
              )
            }))
            return existing.id
          }
        }

        // Create new notification
        const notification: Notification = {
          ...options,
          id,
          timestamp: now,
          count: 1,
          dismissed: false
        }

        // Add to store (keep max queue size)
        set(state => ({
          notifications: [
            notification,
            ...state.notifications
          ].slice(0, NOTIFICATION_CONFIG.maxQueue)
        }))

        // Set auto-dismiss timer if not sticky
        const ttl = getTTL(notification.severity, notification.sticky)
        if (ttl > 0) {
          setTimeout(() => {
            get().dismiss(id)
          }, ttl)
        }

        // Send desktop notification if enabled
        if (
          state.preferences.desktopEnabled &&
          options.desktopEnabled !== false &&
          !isInDNDWindow(state.preferences.dndStart, state.preferences.dndEnd) &&
          NOTIFICATION_CONFIG.desktop.allowedSeverities.includes(notification.severity) &&
          state.permission === 'granted'
        ) {
          sendDesktopNotification(
            notification,
            state.preferences.showPreviews,
            () => {
              // Handle click - focus window and navigate if needed
              if (options.actions?.[0]?.href) {
                window.location.href = options.actions[0].href
              }
            }
          )
        }

        return id
      },

      dismiss: (id: string) => {
        set(state => ({
          notifications: state.notifications.map(n =>
            n.id === id ? { ...n, dismissed: true } : n
          )
        }))
      },

      dismissAll: () => {
        set(state => ({
          notifications: state.notifications.map(n => ({ ...n, dismissed: true }))
        }))
      },

      updatePreferences: (prefs: Partial<NotificationPreferences>) => {
        set(state => ({
          preferences: { ...state.preferences, ...prefs }
        }))
      },

      requestPermission: async () => {
        const permission = await requestDesktopPermission()
        set({ permission })
        return permission
      }
    }),
    {
      name: 'antevus-notifications',
      partialize: (state) => ({
        preferences: state.preferences,
        permission: state.permission
      })
    }
  )
)