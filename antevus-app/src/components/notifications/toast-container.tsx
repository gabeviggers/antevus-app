'use client'

import React, { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNotifications } from '@/hooks/use-notifications'
import { EnhancedToast } from './enhanced-toast'
import { NOTIFICATION_CONFIG } from '@/config/notifications'

export function ToastContainer() {
  const { notifications, dismiss, dismissAll } = useNotifications()
  const [mounted, setMounted] = React.useState(false)

  // Only render on client
  useEffect(() => {
    setMounted(true)
  }, [])

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      const latestNotification = notifications[0]
      if (latestNotification && !latestNotification.sticky) {
        dismiss(latestNotification.id)
      }
    }

    // Cmd/Ctrl + Shift + D to dismiss all
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'd') {
      e.preventDefault()
      dismissAll()
    }
  }, [notifications, dismiss, dismissAll])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!mounted) return null

  // Get visible notifications (max N)
  const visibleNotifications = notifications
    .filter(n => !n.dismissed)
    .slice(0, NOTIFICATION_CONFIG.maxVisible)

  if (visibleNotifications.length === 0) return null

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 flex flex-col items-end justify-start p-4 sm:p-6"
      style={{ zIndex: NOTIFICATION_CONFIG.zIndex }}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="pointer-events-auto w-full max-w-sm">
        {visibleNotifications.map((notification, index) => (
          <EnhancedToast
            key={notification.id}
            notification={notification}
            onDismiss={dismiss}
            index={index}
          />
        ))}

        {/* Queue indicator */}
        {notifications.length > NOTIFICATION_CONFIG.maxVisible && (
          <div className="mt-2 text-center text-xs text-muted-foreground">
            +{notifications.length - NOTIFICATION_CONFIG.maxVisible} more
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}