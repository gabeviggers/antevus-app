import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// In production, this would be stored in a secure database
// For demo purposes, we're using in-memory storage
const apiKeysStore = new Map<string, {
  id: string
  name: string
  hashedKey: string
  last4: string
  created: string
  lastUsed: string
  permissions: string
  // Store the full key only temporarily for initial display
  tempFullKey?: string
  tempFullKeyExpiry?: number
}>()

// Demo mode flag - in production this should be false
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === 'true'

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

function generateApiKey(): string {
  const prefix = IS_DEMO ? 'av_demo_' : 'av_live_'
  const randomBytes = crypto.randomBytes(24).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  return prefix + randomBytes
}

export async function GET(request: NextRequest) {
  try {
    // Return keys without sensitive data
    const keys = Array.from(apiKeysStore.values()).map(key => {
      const { tempFullKey, tempFullKeyExpiry, hashedKey, ...safeData } = key

      // Check if temp key is still valid (1 minute window)
      const canShowFull = IS_DEMO &&
        tempFullKey &&
        tempFullKeyExpiry &&
        Date.now() < tempFullKeyExpiry

      return {
        ...safeData,
        hashedDigest: hashedKey.substring(0, 8), // First 8 chars of hash
        canReveal: IS_DEMO, // Only allow reveal in demo mode
        // Only include full key if within the temporary window AND in demo mode
        ...(canShowFull && { fullKey: tempFullKey })
      }
    })

    return NextResponse.json({ keys })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, permissions = 'All' } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const fullKey = generateApiKey()
    const hashedKey = hashApiKey(fullKey)
    const last4 = fullKey.slice(-4)
    const id = crypto.randomUUID()

    const keyData = {
      id,
      name,
      hashedKey,
      last4,
      created: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      lastUsed: 'Never',
      permissions,
      // Store full key temporarily (1 minute) for initial display only
      tempFullKey: fullKey,
      tempFullKeyExpiry: Date.now() + 60000 // 1 minute
    }

    apiKeysStore.set(id, keyData)

    // Return the full key only once during creation
    return NextResponse.json({
      id,
      name,
      last4,
      created: keyData.created,
      lastUsed: keyData.lastUsed,
      permissions,
      hashedDigest: hashedKey.substring(0, 8),
      // Only return full key once, immediately after creation
      fullKey: fullKey,
      message: 'Store this key securely. It will not be shown again.'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    if (!apiKeysStore.has(id)) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      )
    }

    apiKeysStore.delete(id)

    return NextResponse.json({
      success: true,
      message: 'API key deleted successfully'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete API key' },
      { status: 500 }
    )
  }
}

// Endpoint to reveal key (demo mode only)
export async function PUT(request: NextRequest) {
  try {
    const { id } = await request.json()

    if (!IS_DEMO) {
      return NextResponse.json(
        { error: 'Key reveal is only available in demo mode' },
        { status: 403 }
      )
    }

    const key = apiKeysStore.get(id)
    if (!key) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      )
    }

    // In demo mode, return a mock key for display
    const demoKey = `av_demo_${key.last4}_EXAMPLE_KEY_${crypto.randomBytes(8).toString('hex')}`

    return NextResponse.json({
      demoKey,
      message: 'This is a demo key for display purposes only'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to reveal API key' },
      { status: 500 }
    )
  }
}