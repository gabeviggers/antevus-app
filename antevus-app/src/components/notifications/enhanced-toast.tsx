'use client'

import React from 'react'
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Notification } from '@/lib/notifications/types'
import { escapeHtml, sanitizeLinkProps } from '@/lib/notifications/security'
import { Button } from '@/components/ui/button'

const icons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle
}

const severityStyles = {
  info: 'border-slate-200 dark:border-slate-700',
  success: 'border-green-200 dark:border-green-800',
  warning: 'border-amber-200 dark:border-amber-800',
  error: 'border-red-200 dark:border-red-800'
}

const iconStyles = {
  info: 'text-slate-600 dark:text-slate-400',
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400'
}

interface EnhancedToastProps {
  notification: Notification
  onDismiss: (id: string) => void
  index: number
}

export function EnhancedToast({ notification, onDismiss, index }: EnhancedToastProps) {
  const Icon = icons[notification.severity]
  const shouldReduceMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <div
      className={cn(
        'relative flex w-full max-w-sm overflow-hidden rounded-2xl border bg-background p-4 shadow-lg transition-all duration-200',
        severityStyles[notification.severity],
        index > 0 && 'mt-2',
        shouldReduceMotion ? '' : 'animate-in slide-in-from-right-full'
      )}
      style={{
        zIndex: 9999 - index
      }}
      role="alert"
      aria-live={notification.severity === 'error' ? 'assertive' : 'polite'}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        <Icon className={cn('h-5 w-5', iconStyles[notification.severity])} aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="ml-3 flex-1 space-y-1">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              <span dangerouslySetInnerHTML={{ __html: escapeHtml(notification.title) }} />
              {notification.count > 1 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                  ×{notification.count}
                </span>
              )}
            </p>

            {notification.description && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                <span dangerouslySetInnerHTML={{ __html: escapeHtml(notification.description) }} />
              </p>
            )}

            {/* Actions */}
            {notification.actions && notification.actions.length > 0 && (
              <div className="mt-2 flex gap-2">
                {notification.actions.slice(0, 2).map((action, idx) => {
                  const linkProps = sanitizeLinkProps(action.href)

                  if (action.onClick || !action.href) {
                    return (
                      <Button
                        key={idx}
                        variant={action.variant || 'ghost'}
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          action.onClick?.()
                        }}
                      >
                        {action.label}
                      </Button>
                    )
                  }

                  return (
                    <a
                      key={idx}
                      {...linkProps}
                      className={cn(
                        'inline-flex h-6 items-center rounded-md px-2 text-xs font-medium transition-colors',
                        'hover:bg-accent hover:text-accent-foreground',
                        action.variant === 'destructive' && 'text-destructive hover:bg-destructive/10'
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {action.label}
                    </a>
                  )
                })}
              </div>
            )}
          </div>

          {/* Dismiss button - Always show for all notifications */}
          <button
            onClick={() => onDismiss(notification.id)}
            className="ml-2 inline-flex rounded-md text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}