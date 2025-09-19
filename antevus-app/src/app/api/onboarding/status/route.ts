import { NextRequest, NextResponse } from 'next/server'
// import { authManager } from '@/lib/security/auth-manager' // TODO: Re-enable when needed
import { encryptionService } from '@/lib/security/encryption-service'
import { prisma } from '@/lib/database'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    // Authentication
    const token = process.env.NODE_ENV === "development" ? "demo-token" : null // authManager.getTokenFromRequest(request)
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let userId = 'demo-user-id'
    let isDemo = true

    if (process.env.NODE_ENV === 'production') {
      const session = null // await authManager.validateToken(token)
      if (!session?.userId) {
        return NextResponse.json(
          { error: 'Invalid session' },
          { status: 401 }
        )
      }
      userId = session.userId
      isDemo = false
    }

    // Retrieve complete onboarding progress
    const onboardingProgress = await prisma.onboardingProgress.findUnique({
      where: { userId },
      select: {
        currentStep: true,
        completedSteps: true,
        isCompleted: true,
        completedAt: true,
        startedAt: true,
        profileData: true,
        instrumentsData: true,
        teamData: true,
        agentData: true,
        endpointsData: true
      }
    })

    // If no progress exists, user hasn't started onboarding
    if (!onboardingProgress) {
      return NextResponse.json({
        hasStarted: false,
        currentStep: 'profile',
        nextStep: 'profile',
        completedSteps: [],
        isCompleted: false,
        progress: 0,
        isDemo
      })
    }

    // Decrypt and sanitize data for response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const responseData: any = {
      hasStarted: true,
      currentStep: onboardingProgress.currentStep,
      completedSteps: onboardingProgress.completedSteps,
      isCompleted: onboardingProgress.isCompleted,
      completedAt: onboardingProgress.completedAt,
      startedAt: onboardingProgress.startedAt,
      progress: Math.round((onboardingProgress.completedSteps.length / 5) * 100),
      isDemo
    }

    // Determine next step
    const stepOrder = ['profile', 'instruments', 'agent', 'endpoints', 'team', 'hello']
    const currentIndex = stepOrder.indexOf(onboardingProgress.currentStep)
    responseData.nextStep = currentIndex < stepOrder.length - 1
      ? stepOrder[currentIndex + 1]
      : 'completed'

    // Include summary data (non-sensitive)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summaryData: any = {}

    // Profile summary
    if (onboardingProgress.profileData) {
      try {
        const decryptedProfile = await encryptionService.decrypt(onboardingProgress.profileData)
        const profileData = JSON.parse(decryptedProfile)
        summaryData.profile = {
          hasName: !!profileData.name,
          hasOrganization: !!profileData.organization,
          hasDepartment: !!profileData.department,
          theme: profileData.theme || 'system',
          notifications: !!profileData.notifications
        }
      } catch (error) {
        logger.error('Failed to decrypt profile data', error)
      }
    }

    // Instruments summary
    if (onboardingProgress.instrumentsData) {
      try {
        const decryptedInstruments = await encryptionService.decrypt(onboardingProgress.instrumentsData)
        const instrumentsData = JSON.parse(decryptedInstruments)
        summaryData.instruments = {
          count: instrumentsData.selectedInstruments?.length || 0,
          hasInstruments: (instrumentsData.selectedInstruments?.length || 0) > 0
        }
      } catch (error) {
        logger.error('Failed to decrypt instruments data', error)
      }
    }

    // Team summary
    if (onboardingProgress.teamData) {
      try {
        const decryptedTeam = await encryptionService.decrypt(onboardingProgress.teamData)
        const teamData = JSON.parse(decryptedTeam)
        summaryData.team = {
          invitationCount: teamData.invitations?.length || 0,
          skipped: !!teamData.skipInvitations,
          hasInvitations: (teamData.invitations?.length || 0) > 0
        }
      } catch (error) {
        logger.error('Failed to decrypt team data', error)
      }
    }

    // Agent configuration summary
    if (onboardingProgress.agentData) {
      try {
        const decryptedAgent = await encryptionService.decrypt(onboardingProgress.agentData)
        const agentData = JSON.parse(decryptedAgent)
        summaryData.agent = {
          configured: true,
          hasAutomation: !!agentData.enableAutomation
        }
      } catch (error) {
        logger.error('Failed to decrypt agent data', error)
      }
    }

    // API endpoints summary
    if (onboardingProgress.endpointsData) {
      try {
        const decryptedEndpoints = await encryptionService.decrypt(onboardingProgress.endpointsData)
        const endpointsData = JSON.parse(decryptedEndpoints)
        summaryData.endpoints = {
          configured: true,
          hasApiKey: !!endpointsData.apiKeyGenerated
        }
      } catch (error) {
        logger.error('Failed to decrypt endpoints data', error)
      }
    }

    responseData.data = summaryData

    // Calculate time spent if completed
    if (onboardingProgress.isCompleted && onboardingProgress.completedAt && onboardingProgress.startedAt) {
      const duration = onboardingProgress.completedAt.getTime() - onboardingProgress.startedAt.getTime()
      responseData.completionTime = {
        seconds: Math.round(duration / 1000),
        formatted: formatDuration(duration)
      }
    }

    return NextResponse.json(responseData)

  } catch (error) {
    logger.error('Failed to get onboarding status', error)
    return NextResponse.json(
      { error: 'Failed to retrieve onboarding status' },
      { status: 500 }
    )
  }
}

// Helper function to format duration
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}