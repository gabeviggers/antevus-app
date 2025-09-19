'use client'

import { useSession } from '@/contexts/session-context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated } = useSession()
  const router = useRouter()
  const [isDemoMode, setIsDemoMode] = useState(false)

  useEffect(() => {
    // Check for demo mode completion
    if (process.env.NODE_ENV === 'development') {
      const onboardingComplete = localStorage.getItem('onboarding_complete')
      const demoEmail = localStorage.getItem('demo_email')

      if (onboardingComplete && demoEmail === 'admin@antevus.com') {
        setIsDemoMode(true)
        return // Allow access in demo mode
      }
    }

    if (!isLoading && !isAuthenticated && !isDemoMode) {
      router.push('/')
    }
  }, [isAuthenticated, isLoading, router, isDemoMode])

  if (isLoading && !isDemoMode) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Allow access if authenticated OR in demo mode
  if (!isAuthenticated && !isDemoMode) {
    return null
  }

  return <>{children}</>
}