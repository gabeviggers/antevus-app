import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthenticatedSession } from '@/lib/security/auth-wrapper'

// Development only: Reset rate limits
async function handleGET(request: NextRequest, session: AuthenticatedSession) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
  }

  // Only allow admin users to reset rate limits
  if (!session.roles?.includes('admin')) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  // Clear the in-memory rate limit store
  // Since we're using an in-memory store, restarting the server or clearing the Map will reset it
  // For now, just return success as the rate limits will auto-expire

  return NextResponse.json({
    success: true,
    message: 'Rate limits will reset after timeout period',
    note: 'Restart the dev server to immediately clear all rate limits',
    resetBy: session.userId
  })
}

export const GET = withAuth(handleGET)