import { NextResponse } from 'next/server'
import { authManager } from '@/lib/security/auth-manager'
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/security/audit-logger'
import { isDemoMode } from '@/lib/config/demo-mode'
import { encryptionService } from '@/lib/security/encryption-service'
import { prisma } from '@/lib/database'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
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
    const isDemo = isDemoMode()

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

    // Ensure completedSteps is always an array
    const completedSteps = Array.isArray(onboardingProgress.completedSteps)
      ? onboardingProgress.completedSteps
      : []

    // Normalize completed steps - team and hello are mutually exclusive final steps
    // If both are present, keep only the one that was completed last (team typically)
    const normalizedSteps = completedSteps.filter(step => {
      // If both team and hello are present, keep only team
      if (step === 'hello' && completedSteps.includes('team')) {
        return false
      }
      return true
    })

    // Calculate progress based on 5-step flow (profile, instruments, agent, endpoints, and either team OR hello)
    const totalSteps = 5
    const progressPercentage = Math.min(100, Math.round((normalizedSteps.length / totalSteps) * 100))

    // Decrypt and sanitize data for response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const responseData: any = {
      hasStarted: true,
      currentStep: onboardingProgress.currentStep,
      completedSteps: normalizedSteps,
      isCompleted: onboardingProgress.isCompleted,
      completedAt: onboardingProgress.completedAt,
      startedAt: onboardingProgress.startedAt,
      progress: progressPercentage,
      isDemo
    }

    // Determine next step based on normalized flow
    // The 5-step sequence: profile -> instruments -> agent -> endpoints -> (team OR hello)
    const coreStepOrder = ['profile', 'instruments', 'agent', 'endpoints']
    const finalStep = 'team' // Default final step

    // Find the first uncompleted step
    let nextStep = 'completed'
    for (const step of coreStepOrder) {
      if (!normalizedSteps.includes(step)) {
        nextStep = step
        break
      }
    }

    // If all core steps are done, check final step
    if (nextStep === 'completed' && coreStepOrder.every(step => normalizedSteps.includes(step))) {
      if (!normalizedSteps.includes('team') && !normalizedSteps.includes('hello')) {
        nextStep = finalStep
      }
    }

    responseData.nextStep = nextStep

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