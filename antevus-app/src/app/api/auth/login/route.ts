import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AuthSession, UserRole } from '@/lib/auth/types'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Authenticate with Supabase
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error || !data.user || !data.session) {
      logger.error('Supabase login error', error)
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Get user from local database (should exist from signup sync)
    const localUser = await prisma.user.findUnique({
      where: { id: data.user.id }
    })

    if (!localUser) {
      // Sync user if not found (shouldn't happen but just in case)
      await prisma.user.create({
        data: {
          id: data.user.id,
          email: data.user.email!,
          emailVerified: data.user.email_confirmed_at !== null,
          passwordHash: 'supabase-auth', // Not used with Supabase
          name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
          role: 'USER',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
    }

    // Map role to UserRole enum (handle both uppercase and lowercase)
    const roleMap: Record<string, UserRole> = {
      'ADMIN': UserRole.ADMIN,
      'admin': UserRole.ADMIN,
      'LAB_MANAGER': UserRole.LAB_MANAGER,
      'lab_manager': UserRole.LAB_MANAGER,
      'SCIENTIST': UserRole.SCIENTIST,
      'scientist': UserRole.SCIENTIST,
      'USER': UserRole.VIEWER,
      'user': UserRole.VIEWER,
      'VIEWER': UserRole.VIEWER,
      'viewer': UserRole.VIEWER
    }

    // Create session response
    const session: AuthSession = {
      user: {
        id: data.user.id,
        email: data.user.email!,
        name: localUser?.name || data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
        role: roleMap[localUser?.role || 'USER'] || UserRole.VIEWER,
        organization: 'Antevus Labs', // Default organization
        department: 'Lab Operations', // Default department
        lastLogin: new Date().toISOString(),
        createdAt: localUser?.createdAt?.toISOString() || new Date().toISOString()
      },
      token: data.session.access_token,
      expiresAt: new Date(data.session.expires_at! * 1000).toISOString()
    }

    return NextResponse.json({
      success: true,
      session
    })
  } catch (error) {
    logger.error('Login error', error)
    return NextResponse.json(
      { success: false, error: 'An error occurred during login' },
      { status: 500 }
    )
  }
}