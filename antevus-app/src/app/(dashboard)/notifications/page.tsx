'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Activity, Beaker, Clock, Link, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'system'
export type NotificationCategory = 'instrument' | 'run' | 'integration' | 'system' | 'compliance'

export interface Notification {
  id: string
  title: string
  summary: string
  type: NotificationType
  category: NotificationCategory
  timestamp: Date
  read: boolean
  actionUrl?: string
  instrumentId?: string
  runId?: string
  metadata?: Record<string, unknown>
}

const typeConfig: Record<NotificationType, { icon: React.ElementType; color: string; bgColor: string }> = {
  success: { icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-950/20' },
  error: { icon: AlertCircle, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950/20' },
  warning: { icon: AlertTriangle, color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-50 dark:bg-yellow-950/20' },
  info: { icon: Info, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950/20' },
  system: { icon: Settings, color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-50 dark:bg-gray-950/20' }
}

const categoryConfig: Record<NotificationCategory, { icon: React.ElementType; label: string }> = {
  instrument: { icon: Activity, label: 'Instrument' },
  run: { icon: Beaker, label: 'Run' },
  integration: { icon: Link, label: 'Integration' },
  system: { icon: Settings, label: 'System' },
  compliance: { icon: Clock, label: 'Compliance' }
}

// Comprehensive mock notifications covering all product scenarios
const mockNotifications: Notification[] = [
  // Instrument notifications
  {
    id: '1',
    title: 'PCR-001 Running',
    summary: 'Thermocycler PCR-001 has started protocol "COVID-19 Detection"',
    type: 'info',
    category: 'instrument',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    read: false,
    actionUrl: '/instruments',
    instrumentId: 'PCR-001'
  },
  {
    id: '2',
    title: 'HPLC-02 Error',
    summary: 'Pressure exceeded threshold - pump stopped automatically',
    type: 'error',
    category: 'instrument',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    read: false,
    actionUrl: '/monitoring',
    instrumentId: 'HPLC-02'
  },
  {
    id: '3',
    title: 'MS-003 Maintenance Due',
    summary: 'Mass Spectrometer requires scheduled calibration in 2 days',
    type: 'warning',
    category: 'instrument',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    read: true,
    actionUrl: '/instruments',
    instrumentId: 'MS-003'
  },

  // Run notifications
  {
    id: '4',
    title: 'Run #R-2024-0892 Completed',
    summary: 'Protein quantification completed successfully - 96 samples processed',
    type: 'success',
    category: 'run',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
    read: false,
    actionUrl: '/runs/R-2024-0892',
    runId: 'R-2024-0892'
  },
  {
    id: '5',
    title: 'Run #R-2024-0891 Failed',
    summary: 'qPCR run failed - insufficient sample volume detected',
    type: 'error',
    category: 'run',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    read: false,
    actionUrl: '/runs/R-2024-0891',
    runId: 'R-2024-0891'
  },
  {
    id: '6',
    title: 'QC Check Failed',
    summary: 'Run #R-2024-0890 failed quality control - CV% exceeded 15%',
    type: 'warning',
    category: 'run',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
    read: true,
    actionUrl: '/runs/R-2024-0890',
    runId: 'R-2024-0890'
  },

  // Integration notifications
  {
    id: '7',
    title: 'Benchling Export Complete',
    summary: 'Successfully exported 24 runs to Benchling project "Gene Therapy Q4"',
    type: 'success',
    category: 'integration',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    read: true,
    actionUrl: '/integrations',
    metadata: { integration: 'benchling', count: 24 }
  },
  {
    id: '8',
    title: 'Slack Connection Lost',
    summary: 'Unable to send notifications to #lab-alerts channel',
    type: 'warning',
    category: 'integration',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    read: false,
    actionUrl: '/integrations',
    metadata: { integration: 'slack' }
  },
  {
    id: '9',
    title: 'LIMS Sync Completed',
    summary: '1,247 records synchronized with LabWare LIMS',
    type: 'info',
    category: 'integration',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
    read: true,
    actionUrl: '/integrations',
    metadata: { integration: 'labware', count: 1247 }
  },

  // System notifications
  {
    id: '10',
    title: 'API Rate Limit Warning',
    summary: 'Approaching 80% of hourly API rate limit',
    type: 'warning',
    category: 'system',
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
    read: false,
    actionUrl: '/api',
    metadata: { usage: 80, limit: 10000 }
  },
  {
    id: '11',
    title: 'Storage Quota Alert',
    summary: 'Using 92% of allocated storage (46GB of 50GB)',
    type: 'warning',
    category: 'system',
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
    read: false,
    actionUrl: '/settings',
    metadata: { used: 46, total: 50 }
  },
  {
    id: '12',
    title: 'System Update Available',
    summary: 'Antevus v2.4.0 available - includes new instrument drivers',
    type: 'info',
    category: 'system',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    read: true,
    actionUrl: '/settings'
  },

  // Compliance notifications
  {
    id: '13',
    title: 'Audit Trail Exported',
    summary: 'Q4 2024 audit logs exported for compliance review',
    type: 'success',
    category: 'compliance',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    read: true,
    actionUrl: '/compliance',
    metadata: { quarter: 'Q4', year: 2024 }
  },
  {
    id: '14',
    title: 'E-Signature Required',
    summary: '3 pending runs require supervisor approval',
    type: 'warning',
    category: 'compliance',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    read: false,
    actionUrl: '/runs',
    metadata: { pending: 3 }
  },
  {
    id: '15',
    title: 'Data Retention Policy',
    summary: '47 runs scheduled for deletion per 90-day policy',
    type: 'info',
    category: 'compliance',
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    read: true,
    actionUrl: '/settings',
    metadata: { count: 47, policy: '90-day' }
  }
]

function formatTimestamp(date: Date): string {
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

  if (diffInMinutes < 1) return 'Just now'
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays}d ago`

  return date.toLocaleDateString()
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = React.useState(mockNotifications)
  const [filter, setFilter] = React.useState<NotificationCategory | 'all'>('all')

  const filteredNotifications = React.useMemo(() => {
    if (filter === 'all') return notifications
    return notifications.filter(n => n.category === filter)
  }, [notifications, filter])

  const unreadCount = notifications.filter(n => !n.read).length

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    setNotifications(prev =>
      prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
    )

    // Navigate to action URL if provided
    if (notification.actionUrl) {
      router.push(notification.actionUrl)
    }
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const clearAll = () => {
    setNotifications([])
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-background border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-semibold">Notifications</h1>
                <p className="text-sm text-muted-foreground">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                  Mark all as read
                </Button>
              )}
              {notifications.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  Clear all
                </Button>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-2 overflow-x-auto">
            <Button
              variant={filter === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            {Object.entries(categoryConfig).map(([key, config]) => (
              <Button
                key={key}
                variant={filter === key ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilter(key as NotificationCategory)}
                className="flex items-center gap-1"
              >
                <config.icon className="h-3 w-3" />
                {config.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable Notifications list */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="space-y-2">
        {filteredNotifications.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No notifications</p>
          </Card>
        ) : (
          filteredNotifications.map(notification => {
            const TypeIcon = typeConfig[notification.type].icon
            const CategoryIcon = categoryConfig[notification.category].icon

            return (
              <Card
                key={notification.id}
                className={cn(
                  'p-4 cursor-pointer transition-all hover:shadow-md',
                  !notification.read && 'border-primary/50 bg-accent/5'
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'p-2 rounded-lg flex-shrink-0',
                    typeConfig[notification.type].bgColor
                  )}>
                    <TypeIcon className={cn('h-4 w-4', typeConfig[notification.type].color)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-sm">{notification.title}</h3>
                          {!notification.read && (
                            <div className="h-2 w-2 bg-primary rounded-full" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {notification.summary}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CategoryIcon className="h-3 w-3" />
                        <span>{formatTimestamp(notification.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })
        )}
          </div>
        </div>
      </div>
    </div>
  )
}