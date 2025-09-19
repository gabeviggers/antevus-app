'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { User, LoginCredentials, AuthSession, ROLE_PERMISSIONS, Permission } from '@/lib/auth/types'
import { auditLogger } from '@/lib/audit/logger'
import { useRouter } from 'next/navigation'

interface AuthContextType {
  user: User | null
  session: AuthSession | null
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  hasPermission: (permission: Permission) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isLoading, _setIsLoading] = useState(false) // Changed to false - no loading from storage
  const router = useRouter()

  // SECURITY: Session stored in memory only - never in localStorage
  // For production, use httpOnly cookies with secure flag
  // localStorage is NOT HIPAA compliant for session data

  // Note: Sessions do NOT persist across page refreshes by design
  // This is more secure but requires re-authentication
  // For better UX in production, implement:
  // 1. httpOnly secure cookies for session token
  // 2. Refresh token rotation
  // 3. Silent token refresh before expiry

  const login = async (credentials: LoginCredentials) => {
    try {
      // Call the API route for authentication
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      const data = await response.json()

      if (!data.success) {
        // Log failed login attempt
        auditLogger.logEvent(null, 'user.failed_login', {
          success: false,
          errorMessage: data.error,
          metadata: { email: credentials.email }
        })
        return { success: false, error: data.error }
      }

      // Store session in memory only (HIPAA compliant)
      setSession(data.session)
      // NEVER store session in localStorage - security violation

      // Log successful login
      auditLogger.logEvent(data.session.user, 'user.login', {
        success: true,
        metadata: { sessionExpiry: data.session.expiresAt }
      })

      return { success: true }
    } catch (error) {
      // Log error securely without exposing details
      auditLogger.logEvent(null, 'user.failed_login', {
        success: false,
        errorMessage: 'Login exception',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
      return { success: false, error: 'An error occurred during login' }
    }
  }

  const logout = useCallback(() => {
    // Log audit event
    if (session?.user) {
      auditLogger.logEvent(session.user, 'user.logout', {
        success: true
      })
    }

    setSession(null)
    // Session cleared from memory only
    router.push('/')
  }, [session?.user, router])

  // Auto‑logout on expiry
  useEffect(() => {
    if (!session?.expiresAt) return
    const ms = new Date(session.expiresAt).getTime() - Date.now()
    if (ms <= 0) {
      logout()
      return
    }
    const t = setTimeout(() => logout(), ms)
    return () => clearTimeout(t)
  }, [session?.expiresAt, logout])

  const hasPermission = (permission: Permission): boolean => {
    if (!session?.user) return false
    if (session.expiresAt && new Date(session.expiresAt) <= new Date()) {
      return false
    }

    // Get permissions based on role
    const userPermissions = ROLE_PERMISSIONS[session.user.role] as readonly Permission[]
    if (!userPermissions) return false

    return userPermissions.includes(permission)
  }

  return (
    <AuthContext.Provider
      value={{
        user: session?.user || null,
        session,
        isLoading,
        login,
        logout,
        hasPermission
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}