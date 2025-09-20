import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/onboarding/role' // Default to role selection (first step)
  const type = searchParams.get('type') // Check if it's email confirmation

  if (code) {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      // Sync user to local database
      try {
        const user = data.session.user
        await prisma.user.upsert({
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

        logger.info('User synced to local database after auth callback', {
          userId: user.id,
          email: user.email
        })
      } catch (syncError) {
        logger.error('Failed to sync user to local database', syncError)
      }

      // Check if this is a new user (email confirmation)
      if (type === 'signup' || type === 'email') {
        // Redirect to role selection - the actual first step of onboarding
        return NextResponse.redirect(`${origin}/onboarding/role`)
      }
      // Otherwise redirect to the next page or dashboard
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-error`)
}