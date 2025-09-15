import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
// Credentials API must run on Node.js and never be cached
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
import { z } from 'zod'
import { getServerSession } from '@/lib/auth/session'
import { auditLogger } from '@/lib/audit/logger'
import { validateCSRFToken, createCSRFTokenForUser } from '@/lib/security/csrf'

// AES-256-GCM encryption configuration
const ALGORITHM = 'aes-256-gcm'
const SALT_LENGTH = 64 // Longer salt for key derivation
const TAG_LENGTH = 16
const IV_LENGTH = 16
const ITERATIONS = 100000 // PBKDF2 iterations

// Get encryption key from environment - REQUIRED for production
const MASTER_KEY = (() => {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY

  if (!key) {
    const errorMsg = 'CREDENTIAL_ENCRYPTION_KEY environment variable is required. ' +
      'Please set it to a 64-character hex string (32 bytes) generated with: ' +
      'openssl rand -hex 32'

    // In development, throw a clear error
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[CRITICAL] ${errorMsg}`)
      // Use a development-only key for local testing
      // This ensures developers know they need to set the key
      return 'DEVELOPMENT_ONLY_KEY_DO_NOT_USE_IN_PRODUCTION_' + crypto.randomBytes(16).toString('hex')
    }

    // In production, fail fast and clearly
    throw new Error(errorMsg)
  }

  // Validate key format (should be 64 hex chars = 32 bytes)
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      'CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate with: openssl rand -hex 32'
    )
  }

  return key
})()

// Secure credential storage (in production, use encrypted database)
interface EncryptedCredential {
  encryptedData: string
  salt: string
  iv: string
  authTag: string
  userId: string
  integrationId: string
  createdAt: string
}

const credentialStore = new Map<string, EncryptedCredential>()
// Validation schema for credentials - requires at least one field
const CredentialSchema = z.object({
  apiKey: z.string().min(1).max(500).optional(),
  webhookUrl: z.string().url().optional(),
  accessToken: z.string().optional(),
  secretKey: z.string().optional()
}).refine(
  (data) => {
    // Ensure at least one credential field is provided
    const hasCredentials = Object.keys(data).some(key =>
      data[key as keyof typeof data] !== undefined &&
      data[key as keyof typeof data] !== ''
    )
    return hasCredentials
  },
  {
    message: 'At least one credential field must be provided (apiKey, webhookUrl, accessToken, or secretKey)'
  }
)

// Type for credential data
interface CredentialData {
  apiKey?: string
  webhookUrl?: string
  accessToken?: string
  secretKey?: string
}

// Derive encryption key using PBKDF2
function deriveKey(salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(MASTER_KEY, salt, ITERATIONS, 32, 'sha256')
}

// Encrypt credentials using AES-256-GCM
function encryptCredentials(credentials: CredentialData): {
  encryptedData: string
  salt: string
  iv: string
  authTag: string
} {
  // Generate random salt for key derivation
  const salt = crypto.randomBytes(SALT_LENGTH)
  const key = deriveKey(salt)

  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH)

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  // Encrypt the data
  const plaintext = JSON.stringify(credentials)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  // Get the authentication tag
  const authTag = cipher.getAuthTag()

  return {
    encryptedData: encrypted,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  }
}

// Decrypt credentials using AES-256-GCM
function decryptCredentials(encryptedCredential: {
  encryptedData: string
  salt: string
  iv: string
  authTag: string
}): CredentialData {
  // Derive the same key
  const salt = Buffer.from(encryptedCredential.salt, 'hex')
  const key = deriveKey(salt)

  // Create decipher
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(encryptedCredential.iv, 'hex')
  )

  // Set the authentication tag
  decipher.setAuthTag(Buffer.from(encryptedCredential.authTag, 'hex'))

  // Decrypt the data
  let decrypted = decipher.update(encryptedCredential.encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

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

    // Validate CSRF token for state-changing operations
    const csrfValidation = validateCSRFToken(request, session.user.id, session.user)
    if (!csrfValidation.valid) {
      return NextResponse.json(
        { error: csrfValidation.error || 'Invalid CSRF token' },
        { status: 403 }
      )
    }

    const { id: integrationId } = await params
    const body = await request.json()

    // Early check for empty or null body
    if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
      return NextResponse.json({
        error: 'Invalid request',
        details: 'Request body cannot be empty. At least one credential field must be provided.'
      }, { status: 400 })
    }

    // Validate credentials
    const validation = CredentialSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid credentials',
        details: validation.error.flatten()
      }, { status: 400 })
    }

    // Encrypt credentials using AES-256-GCM
    const encrypted = encryptCredentials(validation.data)
    const credentialId = `${integrationId}_${session.user.id}`

    // Store encrypted credentials with all encryption parameters
    credentialStore.set(credentialId, {
      encryptedData: encrypted.encryptedData,
      salt: encrypted.salt,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
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

    // Generate new CSRF token for future requests
    const csrfToken = createCSRFTokenForUser(session.user.id)

    const { id: integrationId } = await params
    const credentialId = `${integrationId}_${session.user.id}`
    const stored = credentialStore.get(credentialId)

    if (!stored || stored.userId !== session.user.id) {
      return NextResponse.json({
        configured: false,
        message: 'No credentials configured',
        csrfToken // Still provide token for future POST requests
      }, {
        headers: {
          'X-CSRF-Token': csrfToken
        }
      })
    }

    // Never send actual credentials to client
    try {
      // Decrypt only to get field names, never expose values
      const decrypted = decryptCredentials({
        encryptedData: stored.encryptedData,
        salt: stored.salt,
        iv: stored.iv,
        authTag: stored.authTag
      })

      return NextResponse.json({
        configured: true,
        configuredAt: stored.createdAt,
        // Only send field names, not values
        configuredFields: Object.keys(decrypted),
        csrfToken // Include token for future requests
      }, {
        headers: {
          'X-CSRF-Token': csrfToken
        }
      })
    } catch (error) {
      // If decryption fails, still indicate credentials exist
      return NextResponse.json({
        configured: true,
        configuredAt: stored.createdAt,
        configuredFields: ['encrypted'],
        csrfToken
      }, {
        headers: {
          'X-CSRF-Token': csrfToken
        }
      })
    }
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

    // Validate CSRF token for state-changing operations
    const csrfValidation = validateCSRFToken(request, session.user.id, session.user)
    if (!csrfValidation.valid) {
      return NextResponse.json(
        { error: csrfValidation.error || 'Invalid CSRF token' },
        { status: 403 }
      )
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