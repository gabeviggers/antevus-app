import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash, randomUUID } from 'crypto'
import { withAuth, type AuthenticatedSession } from '@/lib/security/auth-wrapper'
import { protectWithCSRF } from '@/lib/security/csrf-middleware'

export const runtime = 'nodejs'
const apiKeysStore = new Map<string, {
  id: string
  name: string
  hashedKey: string
  last4: string
  created: string
  lastUsed: string
  permissions: string
}>()

// Demo mode flag - in production this should be false
const IS_DEMO =
  process.env.DEMO_MODE === 'true' ||
  process.env.NEXT_PUBLIC_DEMO === 'true'
function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

function generateApiKey(): string {
  const prefix = IS_DEMO ? 'av_demo_' : 'av_live_'
  const randomBytesValue = randomBytes(24).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  return prefix + randomBytesValue
}

async function handleGET(_request: NextRequest, _session: AuthenticatedSession) {
  if (!IS_DEMO) {
    return NextResponse.json(
      { error: 'API keys management is only available in demo mode' },
      {
        status: 403,
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    )
  }

  try {
    // Return keys without sensitive data
    const keys = Array.from(apiKeysStore.values()).map(key => {
      const { hashedKey, ...safeData } = key

      return {
        ...safeData,
        hashedDigest: hashedKey.substring(0, 8), // First 8 chars of hash
        canReveal: IS_DEMO // Only allow reveal in demo mode
      }
    })

    return NextResponse.json(
      { keys },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    )
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    )
  }
}

async function handlePOST(request: NextRequest, _session: AuthenticatedSession) {
  if (!IS_DEMO) {
    return NextResponse.json(
      { error: 'API keys management is only available in demo mode' },
      {
        status: 403,
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    )
  }

  try {
    const { name, permissions = 'All' } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store',
            'Vary': 'Authorization'
          }
        }
      )
    }

    const fullKey = generateApiKey()
    const hashedKey = hashApiKey(fullKey)
    const last4 = fullKey.slice(-4)
    const id = randomUUID()

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
      permissions
    }

    apiKeysStore.set(id, keyData)

    // Return the full key only once during creation
    return NextResponse.json(
      {
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
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    )
  } catch {
    return NextResponse.json(
      { error: 'Failed to create API key' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    )
  }
}

async function handleDELETE(request: NextRequest, _session: AuthenticatedSession) {
  if (!IS_DEMO) {
    return NextResponse.json(
      { error: 'API keys management is only available in demo mode' },
      {
        status: 403,
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store',
            'Vary': 'Authorization'
          }
        }
      )
    }

    if (!apiKeysStore.has(id)) {
      return NextResponse.json(
        { error: 'API key not found' },
        {
          status: 404,
          headers: {
            'Cache-Control': 'no-store',
            'Vary': 'Authorization'
          }
        }
      )
    }

    apiKeysStore.delete(id)

    return NextResponse.json(
      {
        success: true,
        message: 'API key deleted successfully'
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    )
  } catch {
    return NextResponse.json(
      { error: 'Failed to delete API key' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    )
  }
}

// Endpoint to reveal key (demo mode only)
async function handlePUT(request: NextRequest, _session: AuthenticatedSession) {
  if (!IS_DEMO) {
    return NextResponse.json(
      { error: 'Key reveal is only available in demo mode' },
      {
        status: 403,
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    )
  }

  try {
    const { id } = await request.json()

    const key = apiKeysStore.get(id)
    if (!key) {
      return NextResponse.json(
        { error: 'API key not found' },
        {
          status: 404,
          headers: {
            'Cache-Control': 'no-store',
            'Vary': 'Authorization'
          }
        }
      )
    }

    // In demo mode, return a mock key for display
    const demoKey = `av_demo_${key.last4}_EXAMPLE_KEY_${randomBytes(8).toString('hex')}`

    return NextResponse.json(
      {
        demoKey,
        message: 'This is a demo key for display purposes only'
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    )
  } catch {
    return NextResponse.json(
      { error: 'Failed to reveal API key' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      }
    )
  }
}

// Export wrapped handlers
export const { GET, POST, PUT, DELETE } = protectWithCSRF({
  GET: withAuth(handleGET),
  POST: withAuth(handlePOST),
  PUT: withAuth(handlePUT),
  DELETE: withAuth(handleDELETE)
})