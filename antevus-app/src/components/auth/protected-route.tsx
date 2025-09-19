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
    // No client-side demo mode bypass - rely on session context
    if (!isLoading && !isAuthenticated) {
      // Check if there's a valid session being established
      const checkAuth = async () => {
        // Give session context time to check for existing sessions
        await new Promise(resolve => setTimeout(resolve, 100))

        if (!isAuthenticated) {
          router.push('/')
        }
      }

      checkAuth()
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