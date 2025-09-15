import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSession } from '@/lib/auth/session'
import { auditLogger } from '@/lib/audit/logger'

// Secure credential storage (in production, use encrypted database)
const credentialStore = new Map<string, {
  encryptedData: string
  userId: string
  integrationId: string
  createdAt: string
}>()

// Validation schema for credentials
const CredentialSchema = z.object({
  apiKey: z.string().min(1).max(500).optional(),
  webhookUrl: z.string().url().optional(),
  accessToken: z.string().optional(),
  secretKey: z.string().optional()
})

// Type for credential data
interface CredentialData {
  apiKey?: string
  webhookUrl?: string
  accessToken?: string
  secretKey?: string
}

// Encrypt credentials (in production, use proper KMS)
function encryptCredentials(credentials: CredentialData): string {
  // In production, use AWS KMS or similar
  const encrypted = Buffer.from(JSON.stringify(credentials)).toString('base64')
  return encrypted
}

// Decrypt credentials (server-side only)
function decryptCredentials(encryptedData: string): CredentialData {
  // In production, use AWS KMS or similar
  const decrypted = Buffer.from(encryptedData, 'base64').toString()
  return JSON.parse(decrypted) as CredentialData
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(request)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: integrationId } = await params
    const body = await request.json()

    // Validate credentials
    const validation = CredentialSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid credentials',
        details: validation.error.flatten()
      }, { status: 400 })
    }

    // Encrypt and store credentials
    const encryptedData = encryptCredentials(validation.data)
    const credentialId = `${integrationId}_${session.user.id}`

    credentialStore.set(credentialId, {
      encryptedData,
      userId: session.user.id,
      integrationId,
      createdAt: new Date().toISOString()
    })

    // Audit log
    auditLogger.logEvent(session.user, 'integration.configure', {
      resourceType: 'credentials',
      resourceId: integrationId,
      success: true,
      metadata: {
        action: 'store_credentials',
        integrationId,
        // Never log actual credentials
        credentialTypes: Object.keys(validation.data)
      }
    })

    // Return sanitized response
    return NextResponse.json({
      success: true,
      message: 'Credentials stored securely',
      // Never return actual credentials
      configured: true,
      configuredFields: Object.keys(validation.data)
    })
  } catch (error) {
    console.error('Error storing credentials:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(request)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: integrationId } = await params
    const credentialId = `${integrationId}_${session.user.id}`
    const stored = credentialStore.get(credentialId)

    if (!stored || stored.userId !== session.user.id) {
      return NextResponse.json({
        configured: false,
        message: 'No credentials configured'
      })
    }

    // Never send actual credentials to client
    return NextResponse.json({
      configured: true,
      configuredAt: stored.createdAt,
      // Only send field names, not values
      configuredFields: Object.keys(decryptCredentials(stored.encryptedData))
    })
  } catch (error) {
    console.error('Error fetching credential status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(request)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: integrationId } = await params
    const credentialId = `${integrationId}_${session.user.id}`

    const stored = credentialStore.get(credentialId)
    if (!stored || stored.userId !== session.user.id) {
      return NextResponse.json({ error: 'Credentials not found' }, { status: 404 })
    }

    credentialStore.delete(credentialId)

    // Audit log
    auditLogger.logEvent(session.user, 'integration.disconnect', {
      resourceType: 'credentials',
      resourceId: integrationId,
      success: true,
      metadata: {
        action: 'delete_credentials',
        integrationId
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Credentials removed securely'
    })
  } catch (error) {
    console.error('Error deleting credentials:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}