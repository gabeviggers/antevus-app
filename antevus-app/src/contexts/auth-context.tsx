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
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Load session from localStorage on mount
  useEffect(() => {
    const storedSession = localStorage.getItem('antevus_session')
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession)
        const isValidShape =
          parsed &&
          typeof parsed.expiresAt === 'string' &&
          parsed.user &&
          typeof parsed.user.id === 'string' &&
          typeof parsed.user.email === 'string' &&
          typeof parsed.user.role === 'string'
        // Only accept well-formed, unexpired sessions
        if (isValidShape && new Date(parsed.expiresAt) > new Date()) {
          setSession(parsed)
        } else {
          localStorage.removeItem('antevus_session')
        }
      } catch (error) {
        console.error('Failed to parse session:', error)
        localStorage.removeItem('antevus_session')
      }
    }
    setIsLoading(false)
  }, [])

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

      // Store session
      setSession(data.session)
      localStorage.setItem('antevus_session', JSON.stringify(data.session))

      // Log successful login
      auditLogger.logEvent(data.session.user, 'user.login', {
        success: true,
        metadata: { sessionExpiry: data.session.expiresAt }
      })

      return { success: true }
    } catch (error) {
      console.error('Login error:', error)
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
    localStorage.removeItem('antevus_session')
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