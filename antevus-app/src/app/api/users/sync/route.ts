import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    // Get Supabase user
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create or update user in local database
    const localUser = await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email!,
        emailVerified: !!user.email_confirmed_at,
        updatedAt: new Date()
      },
      create: {
        id: user.id, // Use Supabase user ID
        email: user.email!,
        emailVerified: !!user.email_confirmed_at,
        passwordHash: 'supabase-auth', // Not used - auth is handled by Supabase
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        role: 'USER', // Default role
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    logger.info('User synced to local database', {
      userId: user.id,
      email: user.email
    })

    return NextResponse.json({
      success: true,
      user: {
        id: localUser.id,
        email: localUser.email,
        role: localUser.role
      }
    })
  } catch (error) {
    logger.error('Failed to sync user', {
      error: error instanceof Error ? error.message : String(error)
    })

    return NextResponse.json(
      { error: 'Failed to sync user' },
      { status: 500 }
    )
  }
}