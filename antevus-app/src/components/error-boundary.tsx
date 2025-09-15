'use client'

import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { auditLogger } from '@/lib/audit/logger'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  resetKeys?: Array<string | number>
  resetOnPropsChange?: boolean
  isolate?: boolean
  level?: 'page' | 'section' | 'component'
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  errorCount: number
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null
  private errorCounter = 0

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.errorCounter++

    // Log to audit system (server-side) for HIPAA/SOC2 compliance
    try {
      fetch('/api/audit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'app.error',
          resourceType: 'error_boundary',
          success: false,
          metadata: {
            // Avoid full stacks; componentStack is already sanitized
            message: process.env.NODE_ENV === 'production' ? 'redacted' : error.message,
            componentStack: errorInfo.componentStack,
            errorCount: this.errorCounter,
            level: this.props.level || 'component'
          }
        })
      }).catch(() => {})
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError)
    }
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Update state with error info
    this.setState({
      errorInfo,
      errorCount: this.errorCounter
    })

    // Auto-retry after 5 seconds for transient errors (max 3 retries)
    if (this.errorCounter <= 3 && !this.props.isolate) {
      this.resetTimeoutId = setTimeout(() => {
        this.resetError()
      }, 5000)
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props
    const { hasError } = this.state

    if (hasError) {
      // Reset on prop changes if configured
      if (resetOnPropsChange && prevProps !== this.props) {
        this.resetError()
        return
      }

      // Reset if resetKeys changed
      if (resetKeys && prevProps.resetKeys !== resetKeys) {
        this.resetError()
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }
  }

  resetError = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
      this.resetTimeoutId = null
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    const { hasError, error, errorCount } = this.state
    const { children, fallback, level = 'component' } = this.props

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return <>{fallback}</>
      }

      // Default error UI based on level
      if (level === 'page') {
        return (
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="max-w-md w-full p-8 bg-card border border-border rounded-lg shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 dark:bg-red-950 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">Something went wrong</h1>
                  <p className="text-sm text-muted-foreground">
                    An unexpected error occurred
                  </p>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-md mb-6">
                <p className="text-sm font-mono text-muted-foreground break-all">
                  {error.message}
                </p>
                {errorCount > 1 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    This error has occurred {errorCount} times
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={this.resetError}
                  className="flex-1"
                  variant="default"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  onClick={() => window.location.href = '/dashboard'}
                  className="flex-1"
                  variant="outline"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go Home
                </Button>
              </div>
            </div>
          </div>
        )
      }

      // Section level error
      if (level === 'section') {
        return (
          <div className="p-6 bg-card border border-border rounded-lg">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium mb-1">Section Error</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  This section encountered an error and cannot be displayed
                </p>
                <p className="text-xs font-mono text-muted-foreground">
                  {error.message}
                </p>
              </div>
            </div>
            <Button onClick={this.resetError} size="sm" variant="outline">
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        )
      }

      // Component level error (minimal UI)
      return (
        <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
          <div className="flex items-center gap-2 text-sm text-red-900 dark:text-red-100">
            <AlertTriangle className="h-4 w-4" />
            <span>Component error</span>
            <button
              onClick={this.resetError}
              className="ml-auto text-xs underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }

    return children
  }
}

// Specific error boundary for integrations
export function IntegrationErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      level="section"
      onError={(error, errorInfo) => {
        console.error('Integration error:', error, errorInfo)
      }}
      fallback={
        <div className="p-6 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div>
              <h3 className="font-medium">Integration Temporarily Unavailable</h3>
              <p className="text-sm text-muted-foreground">
                We&apos;re having trouble loading this integration. Please try again.
              </p>
            </div>
          </div>
          <Button onClick={() => window.location.reload()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Page
          </Button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}

// Dashboard-wide error boundary
export function DashboardErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      level="page"
      resetOnPropsChange
      onError={(error) => {
        // Send critical errors to monitoring service
        if (process.env.NODE_ENV === 'production') {
          // In production, send to Sentry or similar
          console.error('Dashboard critical error:', error)
        }
      }}
    >
      {children}
    </ErrorBoundary>
  )
}