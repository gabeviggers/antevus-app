import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { authManager } from '@/lib/security/auth-manager'
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/security/audit-logger'

const roleSchema = z.object({
  role: z.enum(['admin', 'developer', 'scientist'])
})

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const token = authManager.getTokenFromRequest(request)
    const session = await authManager.validateToken(token)
    if (!session?.userId) {
      auditLogger.log({
        eventType: AuditEventType.AUTH_LOGIN_FAILURE,
        action: 'Unauthorized access attempt',
        metadata: { endpoint: `${request.method} ${request.url}` },
        severity: AuditSeverity.WARNING
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // userId available via session.userId if needed

    // Parse and validate input
    const body = await request.json()
    const validation = roleSchema.safeParse(body)

    if (!validation.success) {
      logger.warn('Invalid role data', {
        errors: validation.error.issues
      })
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.error.issues
      }, { status: 400 })
    }

    const { role } = validation.data

    // For demo mode, store in cookie
    if (process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true') {
      logger.info('Demo role saved', { role })

      const response = NextResponse.json({
        success: true,
        role,
        nextStep: 'profile'
      })

      // Store role in cookie for demo
      response.cookies.set('demo-role', role, {
        httpOnly: true,
        secure: false, // Development only
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/'
      })

      return response
    }

    // In production, would store in database
    return NextResponse.json({
      success: true,
      role,
      nextStep: 'profile'
    })

  } catch (error) {
    logger.error('Role API error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authentication
    const token = authManager.getTokenFromRequest(request)
    const session = await authManager.validateToken(token)
    if (!session?.userId) {
      auditLogger.log({
        eventType: AuditEventType.AUTH_LOGIN_FAILURE,
        action: 'Unauthorized access attempt',
        metadata: { endpoint: `${request.method} ${request.url}` },
        severity: AuditSeverity.WARNING
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // userId available via session.userId if needed

    // For demo mode, retrieve from cookie
    if (process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true') {
      const roleCookie = request.cookies.get('demo-role')

      if (roleCookie) {
        return NextResponse.json({
          role: roleCookie.value,
          success: true
        })
      }
    }

    // Return empty if not found
    return NextResponse.json({
      role: null,
      success: false
    })

  } catch (error) {
    logger.error('Failed to retrieve role', error)
    return NextResponse.json(
      { error: 'Failed to retrieve role' },
      { status: 500 }
    )
  }
}