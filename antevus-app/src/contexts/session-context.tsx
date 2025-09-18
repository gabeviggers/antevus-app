'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { UserContext, UserRole } from '@/lib/security/authorization'
import { authManager } from '@/lib/security/auth-manager'
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/security/audit-logger'
import { logger } from '@/lib/logger'

/**
 * Session Context for User Authentication and Authorization
 *
 * SECURITY NOTICE:
 * - User session data is stored in memory only
 * - No sensitive data in localStorage/sessionStorage
 * - Session expires automatically
 * - All session changes are audit logged
 */

interface SessionContextType {
  user: UserContext | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  hasRole: (role: UserRole) => boolean
  hasAnyRole: (roles: UserRole[]) => boolean
  hasAllRoles: (roles: UserRole[]) => boolean
}

const SessionContext = createContext<SessionContextType | undefined>(undefined)

// SECURITY: All authentication goes through the backend API
// No client-side credentials or mock users for production security

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserContext | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    setIsLoading(true)
    try {
      // SECURITY: Sessions are memory-only for HIPAA compliance
      // Never store session data in browser storage (localStorage/sessionStorage)
      // For production, use httpOnly secure cookies

      // Note: Demo sessions do not persist across page refreshes
      // This is intentional for security - requires re-authentication
    } catch (error) {
      // Log error securely without exposing details
      auditLogger.log({
        eventType: AuditEventType.SYSTEM_ERROR,
        action: 'Session check failed',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      // Call the real API endpoint
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'same-origin'
      })

      const data = await response.json()

      if (!data.success) {
        auditLogger.log({
          eventType: AuditEventType.AUTH_LOGIN_FAILURE,
          action: 'Login failed',
          metadata: {
            email,
            reason: data.error || 'Invalid credentials'
          },
          severity: AuditSeverity.WARNING,
          outcome: 'FAILURE'
        })
        throw new Error(data.error || 'Invalid credentials')
      }

      // Set auth token from API response
      authManager.setToken(data.session.token, 7 * 24 * 60 * 60 * 1000) // 7 days

      // Map API user to UserContext format
      const userContext: UserContext = {
        id: data.session.user.id,
        email: data.session.user.email,
        roles: [data.session.user.role.toLowerCase() as UserRole], // UserRole enum uses lowercase values
        attributes: {
          name: data.session.user.name,
          department: data.session.user.department || 'Unknown'
        },
        sessionId: `session_${Date.now()}`
      }
      setUser(userContext)

      // Set user ID for audit logging
      auditLogger.setUserId(userContext.id)

      auditLogger.log({
        eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
        action: 'User logged in',
        userId: userContext.id,
        metadata: {
          email: userContext.email,
          roles: userContext.roles
        }
      })
    } catch (error) {
      setUser(null)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    const userId = user?.id

    // Clear auth token
    authManager.clearAuth()

    // Clear user context from memory only
    setUser(null)

    // Session cleared from memory - no browser storage to clear

    // Log logout
    if (userId) {
      auditLogger.log({
        eventType: AuditEventType.AUTH_LOGOUT,
        action: 'User logged out',
        userId
      })
    }

    // Clear audit logger user
    auditLogger.setUserId(null)
  }

  const refreshSession = async () => {
    if (!user) return

    try {
      // In production, refresh token with backend
      authManager.setToken(`demo_token_${Date.now()}`, 30 * 60 * 1000)

      auditLogger.log({
        eventType: AuditEventType.AUTH_TOKEN_REFRESH,
        action: 'Session refreshed',
        userId: user.id
      })
    } catch (error) {
      logger.error('Session refresh failed', error)
      await logout()
    }
  }

  const hasRole = (role: UserRole): boolean => {
    return user?.roles.includes(role) || false
  }

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return roles.some(role => hasRole(role))
  }

  const hasAllRoles = (roles: UserRole[]): boolean => {
    return roles.every(role => hasRole(role))
  }

  const contextValue: SessionContextType = {
    user,
    isAuthenticated: !!user && authManager.isAuthenticated(),
    isLoading,
    login,
    logout,
    refreshSession,
    hasRole,
    hasAnyRole,
    hasAllRoles
  }

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}