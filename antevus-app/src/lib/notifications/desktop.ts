import { NotificationOptions } from './types'
import { redactSensitive } from './security'

// Check if desktop notifications are supported
export function isDesktopSupported(): boolean {
  return 'Notification' in window && Notification.permission !== 'denied'
}

// Request permission for desktop notifications
export async function requestDesktopPermission(): Promise<NotificationPermission> {
  if (!isDesktopSupported()) return 'denied'

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  try {
    const permission = await Notification.requestPermission()
    return permission
  } catch (error) {
    console.error('Failed to request notification permission:', error)
    return 'denied'
  }
}

// Check if we're in Do Not Disturb window
export function isInDNDWindow(dndStart?: string, dndEnd?: string): boolean {
  if (!dndStart || !dndEnd) return false

  const now = new Date()
  const currentTime = now.getHours() * 60 + now.getMinutes()

  const [startHour, startMin] = dndStart.split(':').map(Number)
  const [endHour, endMin] = dndEnd.split(':').map(Number)

  const startTime = startHour * 60 + startMin
  const endTime = endHour * 60 + endMin

  // Handle overnight DND (e.g., 22:00 to 07:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime <= endTime
  }

  return currentTime >= startTime && currentTime <= endTime
}

// Send desktop notification
export function sendDesktopNotification(
  options: NotificationOptions,
  showPreviews: boolean,
  onClick?: () => void
): Notification | null {
  if (Notification.permission !== 'granted') return null

  const title = options.privacy ? 'Antevus Update' : options.title
  const body = options.privacy || !showPreviews
    ? 'You have a new update'
    : redactSensitive(options.description || '', false)

  try {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/badge-72x72.png',
      tag: options.correlationId || options.id,
      requireInteraction: options.sticky,
      silent: false,
      data: {
        id: options.id,
        source: options.source,
        metadata: options.metadata
      }
    })

    notification.onclick = (event) => {
      event.preventDefault()
      window.focus()
      notification.close()
      onClick?.()
    }

    // Auto-close after TTL
    if (options.ttl && !options.sticky) {
      setTimeout(() => notification.close(), options.ttl)
    }

    return notification
  } catch (error) {
    console.error('Failed to send desktop notification:', error)
    return null
  }
}