import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// PUT endpoint to validate demo session
export async function PUT(request: NextRequest) {
  try {
    // Check for demo mode
    if (process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true') {
      // Check for demo session cookies
      const demoSession = request.cookies.get('demo-session')
      const demoRole = request.cookies.get('demo-role')
      const onboardingComplete = request.cookies.get('demo-onboarding-complete')

      // If we have a demo session or onboarding is complete, return valid session
      if (demoSession?.value === 'demo-active' || onboardingComplete?.value === 'true') {
        const role = demoRole?.value || 'admin'

        logger.info('Demo session validated', {
          role,
          onboardingComplete: !!onboardingComplete,
          demoSession: !!demoSession
        })

        return NextResponse.json({
          valid: true,
          user: {
            id: 'demo-admin-id',
            email: process.env.DEMO_ALLOWED_EMAIL || 'admin@antevus.com',
            roles: [role, 'demo_user'],
            name: 'Demo Admin'
          }
        })
      }
    }

    // No valid demo session
    return NextResponse.json({
      valid: false,
      message: 'No valid session'
    })

  } catch (error) {
    logger.error('Demo auth validation error', error)
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST endpoint to create demo session (called after login)
export async function POST(request: NextRequest) {
  try {
    // Check for demo mode
    if (process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true') {
      const body = await request.json()

      // Check if this is the demo admin email
      if (body.email === process.env.DEMO_ALLOWED_EMAIL) {
        logger.info('Demo login successful')

        const response = NextResponse.json({
          success: true,
          token: 'demo-token',
          user: {
            id: 'demo-admin-id',
            email: process.env.DEMO_ALLOWED_EMAIL,
            roles: ['admin', 'demo_user'],
            isDemo: true
          }
        })

        // Set demo session cookie
        response.cookies.set('demo-session', 'demo-active', {
          httpOnly: true,
          secure: false, // Development only
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: '/'
        })

        return response
      }
    }

    return NextResponse.json(
      { error: 'Demo mode not available' },
      { status: 403 }
    )

  } catch (error) {
    logger.error('Demo login error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}