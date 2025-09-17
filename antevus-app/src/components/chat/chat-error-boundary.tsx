'use client'

import React from 'react'
import { AlertTriangle, RefreshCw, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logger } from '@/lib/logger'
import { auditLogger, AuditEventType } from '@/lib/security/audit-logger'

interface ChatErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  errorCount: number
}

interface ChatErrorBoundaryProps {
  children: React.ReactNode
  onReset?: () => void
}

export class ChatErrorBoundary extends React.Component<
  ChatErrorBoundaryProps,
  ChatErrorBoundaryState
> {
  constructor(props: ChatErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ChatErrorBoundaryState> {
    // Update state to display fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorCount = this.state.errorCount + 1

    // Log error securely without exposing sensitive details
    logger.error('Chat component error', {
      message: error.message,
      componentStack: errorInfo.componentStack,
      errorCount,
      timestamp: new Date().toISOString()
    })

    // Audit log for compliance
    auditLogger.log({
      eventType: AuditEventType.CHAT_ERROR,
      action: 'Chat component error occurred',
      metadata: {
        errorMessage: error.message,
        errorCount,
        componentStack: errorInfo.componentStack?.substring(0, 500) // Truncate for storage
      }
    })

    this.setState({
      error,
      errorInfo,
      errorCount
    })

    // If too many errors, might want to notify support
    if (errorCount > 3) {
      logger.error('Chat component experiencing repeated errors', {
        errorCount,
        message: 'User may need assistance'
      })
    }
  }

  handleReset = () => {
    // Clear error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    })

    // Call parent reset handler if provided
    if (this.props.onReset) {
      this.props.onReset()
    }

    // Audit log the recovery attempt
    auditLogger.log({
      eventType: AuditEventType.CHAT_ERROR_RECOVERY,
      action: 'User attempted to recover from chat error',
      metadata: {
        previousError: this.state.error?.message
      }
    })
  }

  handleReload = () => {
    // Reload the page for a fresh start
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      const { error, errorCount } = this.state

      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <div className="max-w-md w-full space-y-6 text-center">
            {/* Error Icon */}
            <div className="flex justify-center">
              <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </div>

            {/* Error Message */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">
                Something went wrong with the chat
              </h3>
              <p className="text-sm text-muted-foreground">
                {errorCount > 2
                  ? "The chat is experiencing repeated issues. Please try refreshing the page."
                  : "We encountered an unexpected error. You can try to recover or start a new conversation."}
              </p>
            </div>

            {/* Error Details (Development Only) */}
            {process.env.NODE_ENV === 'development' && error && (
              <details className="text-left bg-muted/50 rounded-lg p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  Error Details
                </summary>
                <pre className="mt-2 text-xs overflow-auto">
                  {error.message}
                  {error.stack?.substring(0, 500)}
                </pre>
              </details>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={this.handleReset}
                variant="default"
                className="gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Try Again
              </Button>
              <Button
                onClick={this.handleReload}
                variant="outline"
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Page
              </Button>
            </div>

            {/* Support Message */}
            {errorCount > 2 && (
              <p className="text-xs text-muted-foreground">
                If this problem persists, please contact support with error code:
                <code className="ml-1 px-1 py-0.5 bg-muted rounded">
                  CHAT-{Date.now().toString(36).toUpperCase()}
                </code>
              </p>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook to wrap chat components with error boundary
 */
export function withChatErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  onReset?: () => void
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const WrappedComponent = (props: any) => (
    <ChatErrorBoundary onReset={onReset}>
      <Component {...props} />
    </ChatErrorBoundary>
  )

  WrappedComponent.displayName = `withChatErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}

/**
 * Chat-specific error class for better error handling
 */
export class ChatError extends Error {
  constructor(
    message: string,
    public code?: string,
    public recoverable: boolean = true
  ) {
    super(message)
    this.name = 'ChatError'
  }
}

// Export default for easy importing
export default ChatErrorBoundary