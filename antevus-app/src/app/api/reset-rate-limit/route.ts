import { NextResponse } from 'next/server'

// Development only: Reset rate limits
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
  }

  // Clear the in-memory rate limit store
  // Since we're using an in-memory store, restarting the server or clearing the Map will reset it
  // For now, just return success as the rate limits will auto-expire

  return NextResponse.json({
    success: true,
    message: 'Rate limits will reset after timeout period',
    note: 'Restart the dev server to immediately clear all rate limits'
  })
}