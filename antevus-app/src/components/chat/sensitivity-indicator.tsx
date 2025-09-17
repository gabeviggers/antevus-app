'use client'

import { Shield, ShieldAlert, ShieldCheck, Info, Lock } from 'lucide-react'
import {
  DataSensitivity,
  DataCategory,
  SENSITIVITY_COLORS,
  SENSITIVITY_ICONS
} from '@/lib/security/data-classification'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SensitivityIndicatorProps {
  sensitivity?: DataSensitivity
  categories?: DataCategory[]
  containsPHI?: boolean
  containsPII?: boolean
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function SensitivityIndicator({
  sensitivity = DataSensitivity.PUBLIC,
  categories = [],
  containsPHI = false,
  containsPII = false,
  showLabel = false,
  size = 'sm',
  className
}: SensitivityIndicatorProps) {
  // Get icon based on sensitivity
  const getIcon = () => {
    switch (sensitivity) {
      case DataSensitivity.CRITICAL:
        return <ShieldAlert className={cn('text-purple-600 dark:text-purple-400', getSizeClass())} />
      case DataSensitivity.RESTRICTED:
        return <ShieldAlert className={cn('text-red-600 dark:text-red-400', getSizeClass())} />
      case DataSensitivity.CONFIDENTIAL:
        return <Shield className={cn('text-amber-600 dark:text-amber-400', getSizeClass())} />
      case DataSensitivity.INTERNAL:
        return <Shield className={cn('text-blue-600 dark:text-blue-400', getSizeClass())} />
      case DataSensitivity.PUBLIC:
      default:
        return <ShieldCheck className={cn('text-green-600 dark:text-green-400', getSizeClass())} />
    }
  }

  const getSizeClass = () => {
    switch (size) {
      case 'lg':
        return 'h-5 w-5'
      case 'md':
        return 'h-4 w-4'
      case 'sm':
      default:
        return 'h-3 w-3'
    }
  }

  const getTooltipContent = () => {
    const lines = []

    // Sensitivity level
    lines.push(`Sensitivity: ${sensitivity}`)

    // Data types
    if (containsPHI) lines.push('⚠️ Contains PHI (Protected Health Information)')
    if (containsPII) lines.push('⚠️ Contains PII (Personal Information)')

    // Categories
    if (categories.length > 0) {
      lines.push(`Categories: ${categories.join(', ')}`)
    }

    // Handling requirements
    switch (sensitivity) {
      case DataSensitivity.CRITICAL:
        lines.push('')
        lines.push('🔒 CRITICAL: Immediate deletion after use')
        lines.push('Requires admin access with MFA')
        break
      case DataSensitivity.RESTRICTED:
        lines.push('')
        lines.push('🔴 RESTRICTED: HIPAA protected')
        lines.push('Encrypted storage required')
        lines.push('Audit logged')
        break
      case DataSensitivity.CONFIDENTIAL:
        lines.push('')
        lines.push('🟡 CONFIDENTIAL: Business sensitive')
        lines.push('Authentication required')
        break
      case DataSensitivity.INTERNAL:
        lines.push('')
        lines.push('🔵 INTERNAL: Company use only')
        break
      case DataSensitivity.PUBLIC:
        lines.push('')
        lines.push('🟢 PUBLIC: No restrictions')
        break
    }

    return lines.join('\n')
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1',
              className
            )}
          >
            {getIcon()}
            {showLabel && (
              <span
                className={cn(
                  'text-xs font-medium',
                  SENSITIVITY_COLORS[sensitivity]
                )}
              >
                {sensitivity}
              </span>
            )}
            {(containsPHI || containsPII) && (
              <Lock className={cn('text-red-500', getSizeClass())} />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent
          className="max-w-xs whitespace-pre-line text-xs"
          side="top"
        >
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Compact badge version for inline use
 */
export function SensitivityBadge({
  sensitivity = DataSensitivity.PUBLIC,
  className
}: {
  sensitivity?: DataSensitivity
  className?: string
}) {
  const colorClass = {
    [DataSensitivity.PUBLIC]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    [DataSensitivity.INTERNAL]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    [DataSensitivity.CONFIDENTIAL]: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    [DataSensitivity.RESTRICTED]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    [DataSensitivity.CRITICAL]: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        colorClass[sensitivity],
        className
      )}
    >
      <span>{SENSITIVITY_ICONS[sensitivity]}</span>
      <span>{sensitivity}</span>
    </span>
  )
}

export default SensitivityIndicator