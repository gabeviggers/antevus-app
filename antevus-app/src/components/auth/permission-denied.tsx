'use client'

import { ShieldOff, Lock, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { UserRole } from '@/lib/security/authorization'

interface PermissionDeniedProps {
  resource?: string
  action?: string
  requiredRole?: UserRole
  currentRole?: UserRole
  message?: string
  onBack?: () => void
}

export function PermissionDenied({
  resource = 'this resource',
  action = 'perform this action',
  requiredRole,
  currentRole,
  message,
  onBack
}: PermissionDeniedProps) {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="p-4 bg-red-50 dark:bg-red-950 rounded-full">
              <ShieldOff className="h-12 w-12 text-red-600 dark:text-red-400" />
            </div>
            <Lock className="absolute -bottom-1 -right-1 h-6 w-6 text-red-600 dark:text-red-400 bg-background rounded-full p-1" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">
            Permission Denied
          </h2>
          <p className="text-sm text-muted-foreground">
            You don&apos;t have permission to {action}
          </p>
        </div>

        {/* Details */}
        <div className="space-y-4">
          {message && (
            <div className="flex items-start gap-3 p-4 bg-muted rounded-lg text-left">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                {message}
              </p>
            </div>
          )}

          <div className="space-y-2 text-sm text-muted-foreground">
            {requiredRole && (
              <div className="flex items-center justify-between px-4 py-2 bg-muted rounded-lg">
                <span>Required Role:</span>
                <span className="font-medium text-foreground">
                  {formatRole(requiredRole)}
                </span>
              </div>
            )}

            {currentRole && (
              <div className="flex items-center justify-between px-4 py-2 bg-muted rounded-lg">
                <span>Your Role:</span>
                <span className="font-medium text-foreground">
                  {formatRole(currentRole)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between px-4 py-2 bg-muted rounded-lg">
              <span>Resource:</span>
              <span className="font-medium text-foreground">
                {formatResource(resource)}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {onBack && (
            <Button
              onClick={onBack}
              className="w-full"
              variant="default"
            >
              Go Back
            </Button>
          )}

          <div className="text-xs text-muted-foreground space-y-1">
            <p>If you believe you should have access, please contact:</p>
            <p className="font-medium">admin@antevus.com</p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            🔒 This access attempt has been logged for security purposes
          </p>
        </div>
      </Card>
    </div>
  )
}

/**
 * Format role name for display
 */
function formatRole(role: string): string {
  return role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Format resource name for display
 */
function formatResource(resource: string): string {
  return resource
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export default PermissionDenied