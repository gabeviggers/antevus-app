'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export type MetricStatus = 'pass' | 'warning' | 'error' | 'neutral'

interface MetricCardProps {
  title: string
  value: string | number
  unit?: string
  status?: MetricStatus
  statusText?: string
  icon?: React.ReactNode
  isSelected?: boolean
  onClick?: () => void
  trend?: {
    value: number
    isPositive: boolean
  }
  className?: string
  disabled?: boolean
}

const statusStyles: Record<MetricStatus, string> = {
  pass: 'text-green-600 dark:text-green-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  error: 'text-red-600 dark:text-red-400',
  neutral: 'text-muted-foreground'
}

const statusBorderStyles: Record<MetricStatus, string> = {
  pass: 'border-green-200 dark:border-green-800',
  warning: 'border-yellow-200 dark:border-yellow-800',
  error: 'border-red-200 dark:border-red-800',
  neutral: 'border-border'
}

export function MetricCard({
  title,
  value,
  unit,
  status = 'neutral',
  statusText,
  icon,
  isSelected = false,
  onClick,
  trend,
  className,
  disabled = false
}: MetricCardProps) {
  const isInteractive = Boolean(onClick) && !disabled
  const Component = isInteractive ? 'button' : 'div'

  return (
    <Component
      {...(isInteractive ? { onClick, disabled } : {})}
      className={cn(
        'px-3 py-2 rounded-md border transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        {
          'cursor-pointer': isInteractive,
          'opacity-50 cursor-not-allowed': disabled,
          'border-primary bg-accent shadow-sm': isSelected && !disabled,
          'border-border hover:border-primary/50 hover:bg-accent/50': !isSelected && isInteractive,
          'border-border': !isSelected && !isInteractive
        },
        status !== 'neutral' && !isSelected && statusBorderStyles[status],
        className
      )}
      aria-pressed={isInteractive ? isSelected : undefined}
      aria-selected={!isInteractive ? isSelected : undefined}
      aria-disabled={disabled || undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1">
          {icon && (
            <div className="text-muted-foreground [&>svg]:h-3 [&>svg]:w-3">
              {icon}
            </div>
          )}
          <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
        </div>
        {trend && trend.value !== 0 && (
          <div className={cn(
            'text-[10px] font-medium',
            trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          )}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </div>
        )}
        {trend && trend.value === 0 && (
          <div className="text-[10px] font-medium text-muted-foreground">
            — 0%
          </div>
        )}
      </div>

      {/* Value */}
      <div className="text-lg font-semibold text-foreground leading-tight">
        {typeof value === 'number'
          ? (Number.isInteger(value)
              ? value.toLocaleString()
              : value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }))
          : value}
        {unit && (
          <span className="text-[10px] font-normal text-muted-foreground ml-1">
            {unit}
          </span>
        )}
      </div>

      {/* Status Text */}
      {statusText && (
        <div className={cn('text-[10px] leading-tight', statusStyles[status])}>
          {statusText}
        </div>
      )}
    </Component>
  )
}

// Status indicator component for use alongside MetricCard
export function MetricStatusIcon({ status }: { status: MetricStatus }) {
  const styles = {
    pass: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    neutral: 'bg-gray-400'
  }

  return (
    <div
      className={cn('h-2 w-2 rounded-full', styles[status])}
      role="img"
      aria-label={`Status: ${status}`}
    />
  )
}