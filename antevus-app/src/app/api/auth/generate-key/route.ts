import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { getServerSession } from '@/lib/auth/session'
import { auditLogger } from '@/lib/audit/logger'
import { validateCSRFToken } from '@/lib/security/csrf'

// Force Node.js runtime for crypto operations
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// AES-256-GCM encryption configuration
const ALGORITHM = 'aes-256-gcm'
const SALT_LENGTH = 64
const IV_LENGTH = 16
// const TAG_LENGTH = 16 // Reserved for future use
const ITERATIONS = 100000

// Get encryption key from environment
function getEncryptionKey(): string {
  const key = process.env.API_KEY_ENCRYPTION_KEY

  if (!key) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[API Keys] Using development encryption key')
      return 'DEV_ONLY_KEY_' + crypto.randomBytes(24).toString('hex')
    }
    throw new Error('API_KEY_ENCRYPTION_KEY is required in production')
  }

  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('API_KEY_ENCRYPTION_KEY must be a 64-character hex string')
  }

  return key
}

// API Key validation schema
const GenerateKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.enum(['read', 'write', 'delete', 'admin'])),
  expiresIn: z.enum(['7d', '30d', '90d', '1y', 'never']).optional(),
  ipAllowlist: z.array(z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$/)).optional(),
  rateLimit: z.number().min(10).max(10000).optional()
})

// API Key storage structure
interface APIKey {
  id: string
  userId: string
  name: string
  key: string // This will be hashed
  prefix: string // Visible prefix for identification
  permissions: string[]
  ipAllowlist?: string[]
  rateLimit: number
  createdAt: string
  expiresAt: string | null
  lastUsedAt: string | null
  usageCount: number
  isActive: boolean
}

// In-memory storage (replace with database in production)
const apiKeyStore = new Map<string, APIKey>()
const keyHashStore = new Map<string, string>() // hash -> id mapping

// Generate a secure API key
function generateAPIKey(): { key: string; prefix: string; hash: string } {
  // Generate 32 bytes of random data
  const keyBytes = crypto.randomBytes(32)
  const prefix = 'ak_' + (process.env.NODE_ENV === 'production' ? 'live' : 'test')
  const key = prefix + '_' + keyBytes.toString('base64url')

  // Create a hash of the key for storage
  const hash = crypto.createHash('sha256').update(key).digest('hex')

  return { key, prefix, hash }
}

// Encrypt sensitive API key metadata
// Encryption function reserved for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function encryptMetadata(data: unknown): { encrypted: string; salt: string; iv: string; authTag: string } {
  const salt = crypto.randomBytes(SALT_LENGTH)
  const key = crypto.pbkdf2Sync(getEncryptionKey(), salt, ITERATIONS, 32, 'sha256')
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return {
    encrypted,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  }
}

// Calculate expiration date
function calculateExpiration(expiresIn: string): string | null {
  if (expiresIn === 'never') return null

  const now = new Date()
  switch (expiresIn) {
    case '7d':
      now.setDate(now.getDate() + 7)
      break
    case '30d':
      now.setDate(now.getDate() + 30)
      break
    case '90d':
      now.setDate(now.getDate() + 90)
      break
    case '1y':
      now.setFullYear(now.getFullYear() + 1)
      break
  }

  return now.toISOString()
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(request)
    if (!session?.user) {
      await auditLogger.log({
        type: 'api.key.generate.failed',
        userId: 'anonymous',
        resourceType: 'api_key',
        resourceId: 'unknown',
        success: false,
        metadata: {
          reason: 'Unauthorized',
          ip: request.ip || request.headers.get('x-forwarded-for') || 'unknown'
        }
      })

      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate CSRF token
    const csrfValidation = validateCSRFToken(request, session.user.id, session.user)
    if (!csrfValidation.valid) {
      await auditLogger.log({
        type: 'api.key.generate.failed',
        userId: session.user.id,
        resourceType: 'api_key',
        resourceId: 'unknown',
        success: false,
        metadata: {
          reason: 'Invalid CSRF token',
          error: csrfValidation.error
        }
      })

      return NextResponse.json(
        { error: csrfValidation.error || 'Invalid CSRF token' },
        { status: 403 }
      )
    }

    // Check user permissions (must be Admin or have API access)
    if (session.user.role !== 'admin' && session.user.role !== 'scientist') {
      await auditLogger.log({
        type: 'api.key.generate.failed',
        userId: session.user.id,
        resourceType: 'api_key',
        resourceId: 'unknown',
        success: false,
        metadata: {
          reason: 'Insufficient permissions',
          userRole: session.user.role
        }
      })

      return NextResponse.json(
        { error: 'Insufficient permissions to generate API keys' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = GenerateKeySchema.safeParse(body)

    if (!validation.success) {
      await auditLogger.log({
        type: 'api.key.generate.failed',
        userId: session.user.id,
        resourceType: 'api_key',
        resourceId: 'unknown',
        success: false,
        metadata: {
          reason: 'Validation failed',
          errors: validation.error.flatten()
        }
      })

      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { name, permissions, expiresIn = '30d', ipAllowlist, rateLimit = 1000 } = validation.data

    // Check for existing keys limit (max 10 active keys per user)
    const userKeys = Array.from(apiKeyStore.values()).filter(
      k => k.userId === session.user.id && k.isActive
    )

    if (userKeys.length >= 10) {
      await auditLogger.log({
        type: 'api.key.generate.failed',
        userId: session.user.id,
        resourceType: 'api_key',
        resourceId: 'unknown',
        success: false,
        metadata: {
          reason: 'Key limit exceeded',
          currentKeys: userKeys.length
        }
      })

      return NextResponse.json(
        { error: 'Maximum number of API keys reached (10)' },
        { status: 400 }
      )
    }

    // Generate the API key
    const { key, prefix, hash } = generateAPIKey()
    const keyId = 'apikey_' + crypto.randomBytes(16).toString('hex')

    // Create API key record
    const apiKey: APIKey = {
      id: keyId,
      userId: session.user.id,
      name,
      key: hash, // Store only the hash
      prefix: prefix + '_' + key.slice(8, 16) + '...', // Store partial for identification
      permissions,
      ipAllowlist,
      rateLimit,
      createdAt: new Date().toISOString(),
      expiresAt: calculateExpiration(expiresIn),
      lastUsedAt: null,
      usageCount: 0,
      isActive: true
    }

    // Store the API key (encrypted in production)
    apiKeyStore.set(keyId, apiKey)
    keyHashStore.set(hash, keyId)

    // Audit log the creation
    await auditLogger.log({
      type: 'api.key.generated',
      userId: session.user.id,
      resourceType: 'api_key',
      resourceId: keyId,
      success: true,
      metadata: {
        name,
        permissions,
        expiresIn,
        hasIpAllowlist: !!ipAllowlist,
        rateLimit,
        prefix: apiKey.prefix
      }
    })

    // Return the key only once (it won't be retrievable again)
    return NextResponse.json({
      id: keyId,
      key, // Full key returned only on creation
      name,
      prefix: apiKey.prefix,
      permissions,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      message: 'Store this key securely. It will not be shown again.'
    })

  } catch (error) {
    console.error('API key generation error:', error)

    await auditLogger.log({
      type: 'api.key.generate.error',
      userId: 'system',
      resourceType: 'api_key',
      resourceId: 'unknown',
      success: false,
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })

    return NextResponse.json(
      { error: 'Failed to generate API key' },
      { status: 500 }
    )
  }
}

// List user's API keys (without exposing the actual keys)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(request)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's API keys
    const userKeys = Array.from(apiKeyStore.values())
      .filter(k => k.userId === session.user.id)
      .map(k => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        permissions: k.permissions,
        rateLimit: k.rateLimit,
        createdAt: k.createdAt,
        expiresAt: k.expiresAt,
        lastUsedAt: k.lastUsedAt,
        usageCount: k.usageCount,
        isActive: k.isActive,
        hasIpAllowlist: !!k.ipAllowlist
      }))

    // Audit the list operation
    await auditLogger.log({
      type: 'api.key.list',
      userId: session.user.id,
      resourceType: 'api_key',
      resourceId: 'all',
      success: true,
      metadata: {
        count: userKeys.length
      }
    })

    return NextResponse.json({ keys: userKeys })

  } catch (error) {
    console.error('API key listing error:', error)
    return NextResponse.json(
      { error: 'Failed to list API keys' },
      { status: 500 }
    )
  }
}

// Revoke an API key
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(request)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate CSRF token
    const csrfValidation = validateCSRFToken(request, session.user.id, session.user)
    if (!csrfValidation.valid) {
      return NextResponse.json(
        { error: csrfValidation.error || 'Invalid CSRF token' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get('id')

    if (!keyId) {
      return NextResponse.json({ error: 'Key ID required' }, { status: 400 })
    }

    const apiKey = apiKeyStore.get(keyId)

    if (!apiKey || apiKey.userId !== session.user.id) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    // Mark as inactive instead of deleting (for audit trail)
    apiKey.isActive = false
    apiKeyStore.set(keyId, apiKey)

    // Audit the revocation
    await auditLogger.log({
      type: 'api.key.revoked',
      userId: session.user.id,
      resourceType: 'api_key',
      resourceId: keyId,
      success: true,
      metadata: {
        name: apiKey.name,
        prefix: apiKey.prefix
      }
    })

    return NextResponse.json({ success: true, message: 'API key revoked' })

  } catch (error) {
    console.error('API key revocation error:', error)
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    )
  }
}