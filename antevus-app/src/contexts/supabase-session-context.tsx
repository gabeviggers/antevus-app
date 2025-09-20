'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { signIn, signUp, signOut, getCurrentUser, getSession } from '@/lib/supabase/auth'
import { UserRole } from '@/lib/security/authorization'
import { auditLogger, AuditEventType } from '@/lib/security/audit-logger'
import { logger } from '@/lib/logger'

interface SessionContextType {
  user: User | null
  session: Session | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

const SessionContext = createContext<SessionContextType | undefined>(undefined)

export function SupabaseSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize Supabase client
  const supabase = createClient()

  useEffect(() => {
    // Check active session
    checkSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      logger.info('Auth state changed:', { event })

      if (session) {
        setSession(session)
        setUser(session.user)
        auditLogger.setUserId(session.user.id)

        // Log auth events
        if (event === 'SIGNED_IN') {
          auditLogger.log({
            eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
            action: 'User signed in via Supabase',
            metadata: { userId: session.user.id, email: session.user.email }
          })
        }
      } else {
        setSession(null)
        setUser(null)
        auditLogger.setUserId('anonymous')

        if (event === 'SIGNED_OUT') {
          auditLogger.log({
            eventType: AuditEventType.AUTH_LOGOUT,
            action: 'User signed out'
          })
        }
      }

      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkSession = async () => {
    setIsLoading(true)
    try {
      const currentSession = await getSession()
      if (currentSession) {
        setSession(currentSession)
        setUser(currentSession.user)
        auditLogger.setUserId(currentSession.user.id)
      }
    } catch (error) {
      logger.error('Session check failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const { session, user } = await signIn(email, password)

      if (session && user) {
        setSession(session)
        setUser(user)
        auditLogger.setUserId(user.id)

        // Create or update user profile in Prisma
        await syncUserWithPrisma(user)

        auditLogger.log({
          eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
          action: 'User logged in successfully',
          metadata: { userId: user.id, email: user.email }
        })
      }
    } catch (error) {
      auditLogger.log({
        eventType: AuditEventType.AUTH_LOGIN_FAILURE,
        action: 'Login failed',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          email
        }
      })
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const { session, user } = await signUp(email, password)

      if (user) {
        // Create user profile in Prisma
        await createUserInPrisma(user)

        auditLogger.log({
          eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
          action: 'User signed up successfully',
          metadata: { userId: user.id, email: user.email }
        })

        // Note: User needs to confirm email before they can login
        // Supabase will send confirmation email automatically
      }
    } catch (error) {
      auditLogger.log({
        eventType: AuditEventType.AUTH_LOGIN_FAILURE,
        action: 'Signup failed',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          email
        }
      })
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    setIsLoading(true)
    try {
      await signOut()
      setSession(null)
      setUser(null)
      auditLogger.setUserId('anonymous')

      auditLogger.log({
        eventType: AuditEventType.AUTH_LOGOUT,
        action: 'User logged out successfully'
      })
    } catch (error) {
      logger.error('Logout failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshSession = async () => {
    const { data, error } = await supabase.auth.refreshSession()
    if (data.session) {
      setSession(data.session)
      setUser(data.session.user)
    }
  }

  // Sync Supabase user with Prisma database
  const syncUserWithPrisma = async (supabaseUser: User) => {
    try {
      const response = await fetch('/api/users/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: supabaseUser.id,
          email: supabaseUser.email,
          emailVerified: supabaseUser.email_confirmed_at
        })
      })

      if (!response.ok) {
        logger.warn('Failed to sync user with Prisma')
      }
    } catch (error) {
      logger.error('User sync error:', error)
    }
  }

  // Create user in Prisma when they sign up
  const createUserInPrisma = async (supabaseUser: User) => {
    try {
      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: supabaseUser.id,
          email: supabaseUser.email
        })
      })

      if (!response.ok) {
        logger.warn('Failed to create user in Prisma')
      }
    } catch (error) {
      logger.error('User creation error:', error)
    }
  }

  const value: SessionContextType = {
    user,
    session,
    isAuthenticated: !!session,
    isLoading,
    login,
    signup,
    logout,
    refreshSession
  }

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSupabaseSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSupabaseSession must be used within SupabaseSessionProvider')
  }
  return context
}