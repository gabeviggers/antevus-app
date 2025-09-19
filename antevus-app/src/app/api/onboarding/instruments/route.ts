import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'

const instrumentsSchema = z.object({
  selectedInstruments: z.array(z.object({
    id: z.string(),
    name: z.string(),
    model: z.string(),
    serial: z.string(),
    status: z.enum(['online', 'offline', 'idle', 'running', 'error', 'maintenance']),
    location: z.string().optional()
  })).min(1, "At least one instrument must be selected")
    .max(50, "Too many instruments selected")
})

export async function POST(request: NextRequest) {
  try {
    // Parse and validate input
    const body = await request.json()
    const validation = instrumentsSchema.safeParse(body)

    if (!validation.success) {
      logger.warn('Invalid instruments data', {
        errors: validation.error.issues
      })
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.error.issues
      }, { status: 400 })
    }

    const instrumentsData = validation.data

    // For demo mode
    if (process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true') {
      logger.info('Demo instruments saved', {
        count: instrumentsData.selectedInstruments.length
      })

      const response = NextResponse.json({
        success: true,
        nextStep: 'agent',
        instrumentsCount: instrumentsData.selectedInstruments.length,
        progress: {
          completedSteps: 2,
          totalSteps: 5,
          percentComplete: 40
        }
      })

      // Store instruments in cookie for demo
      response.cookies.set('demo-instruments', JSON.stringify(instrumentsData), {
        httpOnly: true,
        secure: false, // Development only
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/'
      })

      return response
    }

    // In production, would require authentication and store in database
    return NextResponse.json({
      success: true,
      nextStep: 'agent',
      instrumentsCount: instrumentsData.selectedInstruments.length,
      progress: {
        completedSteps: 2,
        totalSteps: 5,
        percentComplete: 40
      }
    })

  } catch (error) {
    logger.error('Instruments API error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // For demo mode
    if (process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true') {
      const instrumentsCookie = request.cookies.get('demo-instruments')

      if (instrumentsCookie) {
        try {
          const instrumentsData = JSON.parse(instrumentsCookie.value)
          return NextResponse.json({
            instrumentsData,
            currentStep: 'instruments',
            completedSteps: ['profile', 'instruments']
          })
        } catch (e) {
          logger.debug('Could not parse demo instruments cookie')
        }
      }
    }

    // Return empty data if not found
    return NextResponse.json({
      instrumentsData: null,
      currentStep: 'instruments',
      completedSteps: []
    })

  } catch (error) {
    logger.error('Failed to retrieve instruments data', error)
    return NextResponse.json(
      { error: 'Failed to retrieve instruments data' },
      { status: 500 }
    )
  }
}