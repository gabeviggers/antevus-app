import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    // For demo mode
    if (process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true') {
      const teamCookie = request.cookies.get('demo-team')

      if (teamCookie) {
        try {
          const teamData = JSON.parse(teamCookie.value)
          return NextResponse.json({
            teamMembers: teamData.teamMembers || [],
            success: true
          })
        } catch (e) {
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
    const body = await request.json()

    // For demo mode
    if (process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true') {
      logger.info('Demo team invites saved', {
        count: body.invitations?.length || 0
      })

      const response = NextResponse.json({
        success: true,
        message: 'Team invites sent',
        invitationsSent: body.invitations?.length || 0
      })

      // Store team data in cookie for demo
      if (body.invitations && body.invitations.length > 0) {
        response.cookies.set('demo-team', JSON.stringify({
          teamMembers: body.invitations
        }), {
          httpOnly: true,
          secure: false, // Development only
          sameSite: 'strict',
          maxAge: 60 * 60 * 24, // 24 hours
          path: '/'
        })
      }

      return response
    }

    // In production, would send actual invites
    return NextResponse.json({
      success: true,
      message: 'Team invites sent'
    })

  } catch (error) {
    logger.error('Team API error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}