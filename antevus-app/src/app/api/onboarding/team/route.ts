import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { isDemoMode, shouldEnforceCSRF } from '@/lib/config/demo-mode'
import { authManager } from '@/lib/security/auth-manager'
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/security/audit-logger'
import { validateCSRFToken } from '@/lib/security/csrf'

const teamInviteSchema = z.object({
  invitations: z.array(z.object({
    email: z.string().email('Invalid email'),
    role: z.enum(['admin','developer','scientist','viewer']),
    name: z.string().min(1).max(100).optional()
  })).max(20)
}).strict()

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

    // For demo mode
    if (isDemoMode()) {
      const teamCookie = request.cookies.get('demo-team')

      if (teamCookie) {
        try {
          const teamData = JSON.parse(teamCookie.value)
          return NextResponse.json({
            teamMembers: teamData.teamMembers || [],
            success: true
          })
        } catch {
          logger.debug('Could not parse demo team cookie')
        }
      }
    }

    // Return empty team data if not found
    return NextResponse.json({
      teamMembers: [],
      success: true
    })

  } catch (error) {
    logger.error('Failed to retrieve team data', error)
    return NextResponse.json(
      { error: 'Failed to retrieve team data' },
      { status: 500 }
    )
  }
}

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
    const userId = session.userId

    // CSRF validation for state-changing operations
    if (shouldEnforceCSRF()) {
      const csrfValidation = validateCSRFToken(request, userId)
      if (!csrfValidation.valid) {
        await auditLogger.log({
          eventType: AuditEventType.SECURITY_CSRF_DETECTED,
          action: 'CSRF token validation failed',
          userId,
          metadata: {
            endpoint: `${request.method} ${request.url}`,
            reason: csrfValidation.error || 'Unknown'
          },
          severity: AuditSeverity.WARNING
        })
        return NextResponse.json(
          { error: 'Invalid CSRF token' },
          { status: 403 }
        )
      }
    }

    const body = await request.json()

    // Validate request body
    const validation = teamInviteSchema.safeParse(body)
    if (!validation.success) {
      logger.warn('Invalid team invite data', { errors: validation.error.issues })
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.error.issues
      }, { status: 400 })
    }

    const { invitations } = validation.data

    // For demo mode
    if (isDemoMode()) {
      logger.info('Demo team invites saved', { count: invitations.length })

      const response = NextResponse.json({
        success: true,
        message: 'Team invites sent',
        invitationsSent: invitations.length
      })

      // Store team data in cookie for demo
      if (invitations.length > 0) {
        response.cookies.set('demo-team', JSON.stringify({
          teamMembers: invitations
        }), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production', // HTTPS in production, HTTP in dev
          sameSite: 'strict',
          maxAge: 60 * 60 * 24, // 24 hours
          path: '/'
        })
      }

      return response
    }

    // TODO: Implement real invite sending and persistence
    // Until then, fail closed in production
    return NextResponse.json(
      { error: 'Not implemented: invite team' },
      { status: 501 }
    )

  } catch (error) {
    logger.error('Team API error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}