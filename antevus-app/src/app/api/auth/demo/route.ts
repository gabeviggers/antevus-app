import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { isDemoMode } from '@/lib/config/demo-mode'
import { createDemoToken } from '@/lib/security/session-helper'

// PUT endpoint to validate demo session
export async function PUT(request: NextRequest) {
  try {
    // Check for demo mode using centralized function
    if (isDemoMode()) {
      // Check for demo session JWT token
      const demoSession = request.cookies.get('demo-session')
      const onboardingComplete = request.cookies.get('demo-onboarding-complete')

      // If we have a valid JWT demo token, it will be validated by session-helper
      if (demoSession?.value || onboardingComplete?.value === 'true') {
        const role = 'admin' // Demo users get admin role

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
    // Check for demo mode using centralized function
    if (isDemoMode()) {
      const body = await request.json()

      // Check if this is the demo admin email
      if (body.email === process.env.DEMO_ALLOWED_EMAIL) {
        logger.info('Demo login successful')

        // Create a properly signed JWT demo token
        const demoToken = createDemoToken('demo-admin-id', body.email)

        const response = NextResponse.json({
          success: true,
          token: demoToken,
          user: {
            id: 'demo-admin-id',
            email: process.env.DEMO_ALLOWED_EMAIL,
            roles: ['admin', 'demo_user'],
            isDemo: true
          }
        })

        // Set secure demo session cookie with JWT token
        response.cookies.set('demo-session', demoToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60 * 24, // 24 hours
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