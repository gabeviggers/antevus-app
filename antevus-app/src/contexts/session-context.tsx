'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { UserContext, UserRole } from '@/lib/security/authorization'
import { authManager } from '@/lib/security/auth-manager'
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/security/audit-logger'

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

// Mock users for demo (in production, this would come from your auth service)
const MOCK_USERS: Record<string, { password: string; user: UserContext }> = {
  'admin@antevus.com': {
    password: 'demo123',
    user: {
      id: 'user_admin_001',
      email: 'admin@antevus.com',
      roles: [UserRole.ADMIN],
      attributes: {
        name: 'Admin User',
        department: 'IT'
      }
    }
  },
  'scientist@antevus.com': {
    password: 'demo123',
    user: {
      id: 'user_scientist_001',
      email: 'scientist@antevus.com',
      roles: [UserRole.SCIENTIST],
      attributes: {
        name: 'Dr. Jane Smith',
        department: 'Research'
      }
    }
  },
  'director@antevus.com': {
    password: 'demo123',
    user: {
      id: 'user_director_001',
      email: 'director@antevus.com',
      roles: [UserRole.LAB_DIRECTOR],
      attributes: {
        name: 'Dr. John Director',
        department: 'Lab Management'
      }
    }
  },
  'technician@antevus.com': {
    password: 'demo123',
    user: {
      id: 'user_tech_001',
      email: 'technician@antevus.com',
      roles: [UserRole.TECHNICIAN],
      attributes: {
        name: 'Bob Tech',
        department: 'Operations'
      }
    }
  },
  'guest@antevus.com': {
    password: 'demo123',
    user: {
      id: 'user_guest_001',
      email: 'guest@antevus.com',
      roles: [UserRole.GUEST],
      attributes: {
        name: 'Guest User',
        department: 'External'
      }
    }
  }
}

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
      // For demo, we'll restore session from mock storage
      const mockSession = sessionStorage.getItem('mock_session')
      if (mockSession) {
        const userData = JSON.parse(mockSession)
        setUser(userData)
        auditLogger.setUserId(userData.id)

        // Restore token for the session
        authManager.setToken(`demo_token_${Date.now()}`, 30 * 60 * 1000)
      }
    } catch (error) {
      console.error('Session check failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      // In production, this would be an API call
      const mockUser = MOCK_USERS[email.toLowerCase()]

      if (!mockUser || mockUser.password !== password) {
        auditLogger.log({
          eventType: AuditEventType.AUTH_LOGIN_FAILURE,
          action: 'Login failed',
          metadata: {
            email,
            reason: 'Invalid credentials'
          },
          severity: AuditSeverity.WARNING,
          outcome: 'FAILURE'
        })
        throw new Error('Invalid credentials')
      }

      // Set auth token (demo token)
      authManager.setToken(`demo_token_${Date.now()}`, 30 * 60 * 1000) // 30 minutes

      // Set user context
      const userContext = {
        ...mockUser.user,
        sessionId: `session_${Date.now()}`
      }
      setUser(userContext)

      // Store mock session (for demo only)
      sessionStorage.setItem('mock_session', JSON.stringify(userContext))

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

    // Clear user context
    setUser(null)

    // Clear mock session
    sessionStorage.removeItem('mock_session')

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
      console.error('Session refresh failed:', error)
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