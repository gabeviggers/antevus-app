import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // For demo mode, track progress
    if (process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true') {
      logger.info('Demo onboarding progress', {
        step: body.step,
        completed: body.completed,
        onboardingComplete: body.onboardingComplete,
        skipped: body.skipped
      })

      const response = NextResponse.json({
        success: true,
        message: body.onboardingComplete ? 'Onboarding completed!' : 'Progress saved',
        redirectTo: body.onboardingComplete ? '/dashboard' : undefined
      })

      // If onboarding is complete, set completion cookie and auth token
      if (body.onboardingComplete) {
        response.cookies.set('demo-onboarding-complete', 'true', {
          httpOnly: true,
          secure: false, // Development only
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: '/'
        })

        // Ensure demo session stays active
        response.cookies.set('demo-session', 'demo-active', {
          httpOnly: true,
          secure: false, // Development only
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: '/'
        })

        // Set auth token for the session context to recognize
        response.cookies.set('auth-token', 'demo-token-admin', {
          httpOnly: false, // Needs to be accessible by client
          secure: false, // Development only
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: '/'
        })
      }

      return response
    }

    // In production, would update database
    return NextResponse.json({
      success: true,
      message: 'Progress saved'
    })

  } catch (error) {
    logger.error('Progress API error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check progress for demo
    if (process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true') {
      const completeCookie = request.cookies.get('demo-onboarding-complete')
      const roleCookie = request.cookies.get('demo-role')

      return NextResponse.json({
        isCompleted: completeCookie?.value === 'true',
        role: roleCookie?.value || null,
        needsOnboarding: completeCookie?.value !== 'true'
      })
    }

    return NextResponse.json({
      isCompleted: false,
      role: null,
      needsOnboarding: true
    })

  } catch (error) {
    logger.error('Failed to check progress', error)
    return NextResponse.json(
      { error: 'Failed to check progress' },
      { status: 500 }
    )
  }
}