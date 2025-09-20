'use client'

import { useSession } from '@/contexts/session-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated } = useSession()
  const router = useRouter()

  useEffect(() => {
    // Only check authentication after loading is complete
    if (!isLoading && !isAuthenticated) {
      // Use a cancellable timeout to allow for session establishment
      const timeoutId = setTimeout(() => {
        // Check the current authentication state
        if (!isAuthenticated) {
          // Use replace for immediate redirect without history entry
          router.replace('/')
        }
      }, 100) // Small grace period for session to establish

      // Cleanup function to cancel timeout if component unmounts or deps change
      return () => {
        clearTimeout(timeoutId)
      }
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Allow access only if authenticated
  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}