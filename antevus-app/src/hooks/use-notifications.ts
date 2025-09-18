import { useCallback, useEffect } from 'react'
import { useNotificationStore } from '@/stores/notification-store'
import { NotificationOptions } from '@/lib/notifications/types'

export function useNotifications() {
  const store = useNotificationStore()

  // Update permission status on mount
  useEffect(() => {
    if ('Notification' in window) {
      useNotificationStore.setState({ permission: Notification.permission })
    }
  }, [])

  // Request permission if enabled but not granted
  useEffect(() => {
    if (store.preferences.desktopEnabled && store.permission === 'default') {
      store.requestPermission()
    }
  }, [store.preferences.desktopEnabled, store.permission, store.requestPermission])

  const notify = useCallback((options: NotificationOptions) => {
    return store.notify(options)
  }, [store.notify])

  return {
    notify,
    dismiss: store.dismiss,
    dismissAll: store.dismissAll,
    notifications: store.notifications,
    preferences: store.preferences,
    updatePreferences: store.updatePreferences,
    permission: store.permission,
    requestPermission: store.requestPermission
  }
}