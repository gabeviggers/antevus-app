import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * API endpoint for receiving audit logs
 *
 * SECURITY NOTICE:
 * - This endpoint should be protected with authentication in production
 * - Logs should be stored in a secure, immutable storage system
 * - Consider using a dedicated logging service like Datadog, Splunk, or AWS CloudWatch
 */

// Schema for incoming audit logs
const AuditLogBatchSchema = z.object({
  logs: z.array(z.object({
    id: z.string(),
    timestamp: z.string(),
    eventType: z.string(),
    severity: z.string(),
    userId: z.string().nullable(),
    sessionId: z.string().nullable(),
    action: z.string(),
    outcome: z.enum(['SUCCESS', 'FAILURE', 'PENDING']),
    metadata: z.record(z.string(), z.any()).optional()
  })),
  clientTime: z.string()
})

export async function POST(request: NextRequest) {
  try {
    // Get session ID from headers
    const sessionId = request.headers.get('X-Audit-Session')

    // Parse request body
    const body = await request.json()

    // Validate the payload
    const validation = AuditLogBatchSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid audit log format', details: validation.error },
        { status: 400 }
      )
    }

    const { logs, clientTime } = validation.data

    // In production, store these logs in a secure database
    // For now, we'll just log them to the console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AUDIT API] Received ${logs.length} audit logs from session ${sessionId}`)
      logs.forEach(log => {
        console.log(`[AUDIT] ${log.timestamp} - ${log.eventType}: ${log.action}`)
      })
    }

    // In production, you would:
    // 1. Authenticate the request
    // 2. Store logs in a database with proper indexing
    // 3. Forward to SIEM system
    // 4. Trigger alerts for critical events

    return NextResponse.json(
      {
        success: true,
        received: logs.length,
        timestamp: new Date().toISOString()
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache'
        }
      }
    )
  } catch (error) {
    console.error('[AUDIT API] Error processing audit logs:', error)
    return NextResponse.json(
      { error: 'Failed to process audit logs' },
      { status: 500 }
    )
  }
}

// Only allow POST method
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}