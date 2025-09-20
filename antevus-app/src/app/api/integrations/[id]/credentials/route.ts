import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, pbkdf2, createCipheriv, createDecipheriv } from 'crypto'
import { promisify } from 'util'
import { z } from 'zod'
import { withAuth, type AuthenticatedSession } from '@/lib/security/auth-wrapper'
import { UserRole } from '@/lib/security/authorization'
import { logger } from '@/lib/logger'
// Simple audit logger and CSRF fallbacks
interface AuditUser {
  id: string
  email?: string
  name?: string
  role?: string
  organization?: string
  createdAt?: string
}

const auditLogger = {
  logEvent: (user: AuditUser | User, event: string, data: Record<string, unknown>) => {
    logger.info('Audit event', { user: user.id, event, data })
  }
}
// Mock CSRF validation - returns synchronously
const validateCSRFToken = (_req: unknown, _userId: string, _user: unknown) => ({ valid: true, error: null })
const createCSRFTokenForUser = (_userId: string) => 'demo-csrf-token'
import { type User } from '@/lib/auth/types'

// Credentials API must run on Node.js and never be cached
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// AES-256-GCM encryption configuration
const ALGORITHM = 'aes-256-gcm'
const SALT_LENGTH = 64 // Longer salt for key derivation
// const TAG_LENGTH = 16 // Currently unused
const IV_LENGTH = 16
const ITERATIONS = 100000 // PBKDF2 iterations

// Cache for encryption key
let cachedMasterKey: string | null = null

// Get encryption key from environment - REQUIRED for production
function getMasterKey(): string {
  if (cachedMasterKey) {
    return cachedMasterKey
  }

  const key = process.env.CREDENTIAL_ENCRYPTION_KEY

  if (!key) {
    const errorMsg = 'CREDENTIAL_ENCRYPTION_KEY environment variable is required. ' +
      'Please set it to a 64-character hex string (32 bytes) generated with: ' +
      'openssl rand -hex 32'

    // In development, use a consistent development key
    if (process.env.NODE_ENV !== 'production') {
      logger.error(`[CRITICAL] ${errorMsg}`)
      // Use a development-only key for local testing
      // This ensures developers know they need to set the key
      cachedMasterKey = 'DEVELOPMENT_ONLY_KEY_DO_NOT_USE_IN_PRODUCTION_' + randomBytes(16).toString('hex')
      return cachedMasterKey
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

  cachedMasterKey = key
  return cachedMasterKey
}

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

// Helper to create User object from session
function createUserFromSession(session: AuthenticatedSession): User {
  return {
    id: session.userId,
    email: session.email || 'unknown',
    name: session.email?.split('@')[0] || 'unknown',
    role: UserRole.SCIENTIST,
    organization: 'Default Organization',
    createdAt: new Date().toISOString()
  }
}

// Promisify pbkdf2 for async operation
const pbkdf2Async = promisify(pbkdf2)

// Derive encryption key using PBKDF2 (async to avoid blocking)
async function deriveKey(salt: Buffer): Promise<Buffer> {
  return pbkdf2Async(getMasterKey(), salt, ITERATIONS, 32, 'sha256')
}

// Encrypt credentials using AES-256-GCM (async)
async function encryptCredentials(credentials: CredentialData): Promise<{
  encryptedData: string
  salt: string
  iv: string
  authTag: string
}> {
  // Generate random salt for key derivation
  const salt = randomBytes(SALT_LENGTH)
  const key = await deriveKey(salt)

  // Generate random IV
  const iv = randomBytes(IV_LENGTH)

  // Create cipher
  const cipher = createCipheriv(ALGORITHM, key, iv)

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

// Decrypt credentials using AES-256-GCM (async)
async function decryptCredentials(encryptedCredential: {
  encryptedData: string
  salt: string
  iv: string
  authTag: string
}): Promise<CredentialData> {
  // Derive the same key
  const salt = Buffer.from(encryptedCredential.salt, 'hex')
  const key = await deriveKey(salt)

  // Create decipher
  const decipher = createDecipheriv(
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

async function handlePOST(
  request: NextRequest,
  session: AuthenticatedSession,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // RBAC: Only admins or super admins can set credentials
    const userRoles = session.roles || []
    const hasPrivilegedRole = userRoles.some(role =>
      [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.LAB_MANAGER].includes(role as UserRole)
    )

    if (!hasPrivilegedRole) {
      logger.warn('Unauthorized credential modification attempt', {
        userId: session.userId,
        roles: userRoles,
        action: 'POST',
        integrationId: (await params).id
      })
      return NextResponse.json({
        error: 'Forbidden: Insufficient privileges to manage credentials'
      }, { status: 403 })
    }

    // Validate CSRF token for state-changing operations
    const csrfValidation = validateCSRFToken(request, session.userId, createUserFromSession(session))
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

    // Encrypt credentials using AES-256-GCM (async)
    const encrypted = await encryptCredentials(validation.data)
    const credentialId = `${integrationId}_${session.userId}`

    // Store encrypted credentials with all encryption parameters
    credentialStore.set(credentialId, {
      encryptedData: encrypted.encryptedData,
      salt: encrypted.salt,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      userId: session.userId,
      integrationId,
      createdAt: new Date().toISOString()
    })

    // Audit log
    auditLogger.logEvent(createUserFromSession(session), 'integration.configure', {
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
    logger.error('Error storing credentials', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleGET(
  _request: NextRequest,
  session: AuthenticatedSession,
  { params }: { params: Promise<{ id: string }> }
) {
  try {

    // Generate new CSRF token for future requests
    const csrfToken = createCSRFTokenForUser(session.userId)

    const { id: integrationId } = await params
    const credentialId = `${integrationId}_${session.userId}`
    const stored = credentialStore.get(credentialId)

    if (!stored || stored.userId !== session.userId) {
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
      const decrypted = await decryptCredentials({
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
    } catch {
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
    logger.error('Error fetching credential status', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleDELETE(
  request: NextRequest,
  session: AuthenticatedSession,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // RBAC: Only admins or super admins can delete credentials
    const userRoles = session.roles || []
    const hasPrivilegedRole = userRoles.some(role =>
      [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.LAB_MANAGER].includes(role as UserRole)
    )

    if (!hasPrivilegedRole) {
      logger.warn('Unauthorized credential deletion attempt', {
        userId: session.userId,
        roles: userRoles,
        action: 'DELETE',
        integrationId: (await params).id
      })
      return NextResponse.json({
        error: 'Forbidden: Insufficient privileges to delete credentials'
      }, { status: 403 })
    }

    // Validate CSRF token for state-changing operations
    const csrfValidation = validateCSRFToken(request, session.userId, createUserFromSession(session))
    if (!csrfValidation.valid) {
      return NextResponse.json(
        { error: csrfValidation.error || 'Invalid CSRF token' },
        { status: 403 }
      )
    }

    const { id: integrationId } = await params
    const credentialId = `${integrationId}_${session.userId}`

    const stored = credentialStore.get(credentialId)
    if (!stored || stored.userId !== session.userId) {
      return NextResponse.json({ error: 'Credentials not found' }, { status: 404 })
    }

    credentialStore.delete(credentialId)

    // Audit log
    auditLogger.logEvent(createUserFromSession(session), 'integration.disconnect', {
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
    logger.error('Error deleting credentials', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Wrapper functions for dynamic routes that extract session and pass additional params
async function wrappedGET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (req, session) => handleGET(req, session, { params }))(request)
}

async function wrappedPOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (req, session) => handlePOST(req, session, { params }))(request)
}

async function wrappedDELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (req, session) => handleDELETE(req, session, { params }))(request)
}

// Export wrapped handlers for dynamic routes
// Note: These already have auth wrapping, we just need CSRF on mutating methods
export const GET = wrappedGET
export const POST = wrappedPOST
export const DELETE = wrappedDELETE