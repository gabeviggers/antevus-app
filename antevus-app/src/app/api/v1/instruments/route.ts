import { NextRequest, NextResponse } from 'next/server'
import { validateAPIKey } from '@/lib/api/auth-db'
import { auditLogger } from '@/lib/audit/logger'
import { mockInstruments } from '@/lib/mock-data/instruments'
import { logger } from '@/lib/logger'

// Force Node.js runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/v1/instruments - List all instruments
export async function GET(request: NextRequest) {
  // Validate API key
  const authResult = await validateAPIKey(request, ['read'])

  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: authResult.error },
      {
        status: authResult.error === 'Rate limit exceeded' ? 429 : 401,
        headers: {
          ...(authResult.rateLimitRemaining !== undefined && {
            'X-RateLimit-Limit': '1000',
            'X-RateLimit-Remaining': authResult.rateLimitRemaining.toString(),
            'X-RateLimit-Reset': new Date(authResult.rateLimitReset || 0).toISOString()
          })
        }
      }
    )
  }

  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Filter instruments
    let filteredInstruments = [...mockInstruments]

    if (status) {
      filteredInstruments = filteredInstruments.filter(i => i.status === status)
    }

    if (type) {
      filteredInstruments = filteredInstruments.filter(i => i.type === type)
    }

    // Apply pagination
    const total = filteredInstruments.length
    const paginatedInstruments = filteredInstruments.slice(offset, offset + limit)

    // Format response
    const response = {
      instruments: paginatedInstruments.map(instrument => ({
        id: instrument.id,
        name: instrument.name,
        type: instrument.type,
        status: instrument.status,
        location: instrument.location,
        lastSeen: new Date().toISOString(),
        metadata: {
          model: instrument.model,
          serialNumber: `SN-${instrument.id.slice(-6).toUpperCase()}`,
          firmware: 'v3.2.1'
        }
      })),
      total,
      offset,
      limit,
      _links: {
        self: `/api/v1/instruments?offset=${offset}&limit=${limit}`,
        ...(offset > 0 && {
          prev: `/api/v1/instruments?offset=${Math.max(0, offset - limit)}&limit=${limit}`
        }),
        ...(offset + limit < total && {
          next: `/api/v1/instruments?offset=${offset + limit}&limit=${limit}`
        })
      }
    }

    // Audit log the API call
    await auditLogger.logEvent(
      null, // No user object available in API context
      'api.instruments.list',
      {
        resourceType: 'instruments',
        resourceId: 'all',
        success: true,
        metadata: {
          userId: authResult.userId,
          keyId: authResult.keyId,
          filters: { status, type },
          pagination: { offset, limit },
          resultCount: paginatedInstruments.length
        }
      }
    )

    return NextResponse.json(response, {
      headers: {
        'X-Total-Count': total.toString(),
        'X-RateLimit-Limit': '1000',
        'X-RateLimit-Remaining': authResult.rateLimitRemaining?.toString() || '999',
        'X-RateLimit-Reset': new Date(authResult.rateLimitReset || 0).toISOString(),
        'Cache-Control': 'private, max-age=60'
      }
    })

  } catch (error) {
    logger.error('Instruments API failed', error, { userId: authResult.userId })

    await auditLogger.logEvent(
      null,
      'api.instruments.error',
      {
        resourceType: 'instruments',
        resourceId: 'all',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          userId: authResult.userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    )

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/v1/instruments - Register a new instrument (requires write permission)
export async function POST(request: NextRequest) {
  // Validate API key with write permission
  const authResult = await validateAPIKey(request, ['write'])

  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: authResult.error },
      {
        status: authResult.error === 'Rate limit exceeded' ? 429 : 401,
        headers: {
          ...(authResult.rateLimitRemaining !== undefined && {
            'X-RateLimit-Limit': '1000',
            'X-RateLimit-Remaining': authResult.rateLimitRemaining.toString(),
            'X-RateLimit-Reset': new Date(authResult.rateLimitReset || 0).toISOString()
          })
        }
      }
    )
  }

  try {
    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.type || !body.location) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, location' },
        { status: 400 }
      )
    }

    // Create new instrument (mock)
    const newInstrument = {
      id: `inst_${Date.now()}`,
      name: body.name,
      type: body.type,
      status: 'idle',
      location: body.location,
      model: body.model || 'Unknown',
      createdAt: new Date().toISOString(),
      createdBy: authResult.userId
    }

    // Audit log the creation
    await auditLogger.logEvent(
      null,
      'api.instruments.create',
      {
        resourceType: 'instruments',
        resourceId: newInstrument.id,
        success: true,
        metadata: {
          userId: authResult.userId,
          keyId: authResult.keyId,
          instrument: newInstrument
        }
      }
    )

    return NextResponse.json(newInstrument, {
      status: 201,
      headers: {
        'Location': `/api/v1/instruments/${newInstrument.id}`,
        'X-RateLimit-Limit': '1000',
        'X-RateLimit-Remaining': authResult.rateLimitRemaining?.toString() || '999',
        'X-RateLimit-Reset': new Date(authResult.rateLimitReset || 0).toISOString()
      }
    })

  } catch (error) {
    logger.error('Instrument creation failed', error, { userId: authResult.userId })

    await auditLogger.logEvent(
      null,
      'api.instruments.error',
      {
        resourceType: 'instruments',
        resourceId: 'new',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          userId: authResult.userId,
          operation: 'create',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    )

    return NextResponse.json(
      { error: 'Failed to create instrument' },
      { status: 500 }
    )
  }
}