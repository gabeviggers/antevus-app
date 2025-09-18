'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCircle, AlertCircle, Info, AlertTriangle, Settings, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'system'

export interface NotificationPreview {
  id: string
  title: string
  summary: string
  type: NotificationType
  timestamp: Date
  read: boolean
  actionUrl?: string
}

const typeConfig: Record<NotificationType, { icon: React.ElementType; color: string; bgColor: string }> = {
  success: { icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-950/20' },
  error: { icon: AlertCircle, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950/20' },
  warning: { icon: AlertTriangle, color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-50 dark:bg-yellow-950/20' },
  info: { icon: Info, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950/20' },
  system: { icon: Settings, color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-50 dark:bg-gray-950/20' }
}

// Recent notifications for preview
const recentNotifications: NotificationPreview[] = [
  {
    id: '1',
    title: 'PCR-001 Running',
    summary: 'Thermocycler started protocol',
    type: 'info',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    read: false,
    actionUrl: '/instruments'
  },
  {
    id: '2',
    title: 'Run Completed',
    summary: '96 samples processed',
    type: 'success',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    read: false,
    actionUrl: '/runs/R-2024-0892'
  },
  {
    id: '3',
    title: 'HPLC-02 Error',
    summary: 'Pressure threshold exceeded',
    type: 'error',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    read: false,
    actionUrl: '/monitoring'
  },
  {
    id: '4',
    title: 'Maintenance Due',
    summary: 'MS-003 calibration needed',
    type: 'warning',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
    read: true,
    actionUrl: '/instruments'
  }
]

function formatTimestamp(date: Date): string {
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

  if (diffInMinutes < 1) return 'Now'
  if (diffInMinutes < 60) return `${diffInMinutes}m`

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h`

  return `${Math.floor(diffInHours / 24)}d`
}

interface NotificationsDropdownProps {
  className?: string
}

export function NotificationsDropdown({ className }: NotificationsDropdownProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = React.useState(false)
  const [notifications, setNotifications] = React.useState(recentNotifications)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter(n => !n.read).length

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleNotificationClick = (notification: NotificationPreview) => {
    // Mark as read
    setNotifications(prev =>
      prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
    )

    // Close dropdown
    setIsOpen(false)

    // Navigate to action URL if provided
    if (notification.actionUrl) {
      router.push(notification.actionUrl)
    }
  }

  const handleViewAll = () => {
    setIsOpen(false)
    router.push('/notifications')
  }

  return (
    <div ref={dropdownRef} className={cn("relative", className)}>
      {/* Bell Icon Button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Notifications"
        title="Notifications"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <>
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full animate-pulse" aria-hidden="true" />
            <span className="sr-only">{unreadCount} unread notifications</span>
          </>
        )}
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-lg shadow-lg z-50"
          onMouseLeave={() => setIsOpen(false)}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {unreadCount} unread
                </span>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications
              </div>
            ) : (
              <div className="py-1">
                {notifications.map(notification => {
                  const TypeIcon = typeConfig[notification.type].icon

                  return (
                    <button
                      key={notification.id}
                      className="w-full px-4 py-3 hover:bg-accent transition-colors text-left border-b border-border/50 last:border-0"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'p-1.5 rounded flex-shrink-0',
                          typeConfig[notification.type].bgColor
                        )}>
                          <TypeIcon className={cn('h-3 w-3', typeConfig[notification.type].color)} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-medium">{notification.title}</p>
                                {!notification.read && (
                                  <div className="h-1.5 w-1.5 bg-primary rounded-full" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                {notification.summary}
                              </p>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {formatTimestamp(notification.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border">
            <button
              className="w-full text-xs text-primary hover:underline flex items-center justify-center gap-1"
              onClick={handleViewAll}
            >
              View all notifications
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}