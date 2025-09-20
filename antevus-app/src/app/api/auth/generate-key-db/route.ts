/**
 * API Key Generation with Database Backend
 * Production-ready key generation using PostgreSQL
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { UserRole } from '@/lib/security/authorization'
import { getServerSession } from '@/lib/security/session-helper'
import { auditLogger } from '@/lib/audit/logger'
import { validateCSRFToken } from '@/lib/security/csrf'
import { logger } from '@/lib/logger'
import { apiKeyRepository } from '@/lib/db/repositories/api-key.repository'

// Force Node.js runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// API Key validation schema
const GenerateKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.enum(['read', 'write', 'delete', 'admin'])),
  expiresIn: z.enum(['7d', '30d', '90d', '1y', 'never']).optional(),
  ipAllowlist: z.array(z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$/)).optional(),
  rateLimit: z.number().min(10).max(10000).optional()
})

export async function POST(request: NextRequest) {
  let session: Awaited<ReturnType<typeof getServerSession>> | null = null

  try {
    // Verify authentication
    session = await getServerSession(request)
    if (!session) {
      await auditLogger.logEvent(
        null,
        'api.key.generate.failed',
        {
          resourceType: 'api_key',
          resourceId: 'unknown',
          success: false,
          errorMessage: 'Unauthorized',
          metadata: {
            reason: 'Unauthorized',
            ip: request.headers.get('x-forwarded-for') || 'unknown'
          }
        }
      )

      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate CSRF token
    const csrfValidation = validateCSRFToken(request, session.userId)
    if (!csrfValidation.valid) {
      await auditLogger.logEvent(
        { id: session.userId, email: session.email, name: '', role: session.role as UserRole, organization: 'unknown', createdAt: new Date().toISOString() },
        'api.key.generate.failed',
        {
          resourceType: 'api_key',
          resourceId: 'unknown',
          success: false,
          errorMessage: 'Invalid CSRF token',
          metadata: {
            reason: 'Invalid CSRF token',
            error: csrfValidation.error
          }
        }
      )

      return NextResponse.json(
        { error: csrfValidation.error || 'Invalid CSRF token' },
        { status: 403 }
      )
    }

    // Check user permissions (must be Admin or Scientist)
    if (session.role !== UserRole.ADMIN && session.role !== UserRole.SCIENTIST) {
      await auditLogger.logEvent(
        { id: session.userId, email: session.email, name: '', role: session.role as UserRole, organization: 'unknown', createdAt: new Date().toISOString() },
        'api.key.generate.failed',
        {
          resourceType: 'api_key',
          resourceId: 'unknown',
          success: false,
          errorMessage: 'Insufficient permissions',
          metadata: {
            reason: 'Insufficient permissions',
            userRole: session.role
          }
        }
      )

      return NextResponse.json(
        { error: 'Insufficient permissions to generate API keys' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = GenerateKeySchema.safeParse(body)

    if (!validation.success) {
      await auditLogger.logEvent(
        { id: session.userId, email: session.email, name: '', role: session.role as UserRole, organization: 'unknown', createdAt: new Date().toISOString() },
        'api.key.generate.failed',
        {
          resourceType: 'api_key',
          resourceId: 'unknown',
          success: false,
          errorMessage: 'Validation failed',
          metadata: {
            reason: 'Validation failed',
            errors: validation.error.issues
          }
        }
      )

      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { name, permissions, expiresIn = '30d', ipAllowlist, rateLimit = 1000 } = validation.data

    // Generate API key using database repository
    const { key, apiKey } = await apiKeyRepository.create({
      userId: session.userId,
      name,
      permissions,
      ipAllowlist,
      rateLimit,
      expiresIn
    })

    // Audit log the creation
    await auditLogger.logEvent(
      { id: session.userId, email: session.email, name: '', role: session.role as UserRole, organization: 'unknown', createdAt: new Date().toISOString() },
      'api.key.generate',
      {
        resourceType: 'api_key',
        resourceId: apiKey.id,
        success: true,
        metadata: {
          name,
          permissions,
          expiresIn,
          hasIpAllowlist: !!ipAllowlist,
          rateLimit,
          prefix: apiKey.keyPrefix
        }
      }
    )

    // Return the key only once (it won't be retrievable again)
    return NextResponse.json({
      id: apiKey.id,
      key, // Full key returned only on creation - NEVER stored anywhere
      name,
      prefix: apiKey.keyPrefix,
      permissions,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      message: 'Store this key securely. It will not be shown again.'
    })

  } catch (error) {
    // Check for specific errors
    if (error instanceof Error && error.message.includes('Maximum number of API keys')) {
      await auditLogger.logEvent(
        session ? { id: session.userId, email: session.email, name: '', role: session.role as UserRole, organization: 'unknown', createdAt: new Date().toISOString() } : null,
        'api.key.generate.failed',
        {
          resourceType: 'api_key',
          resourceId: 'unknown',
          success: false,
          errorMessage: error.message,
          metadata: {
            reason: 'Key limit exceeded'
          }
        }
      )

      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.error('API key generation failed', error, { userId: session?.userId })

    await auditLogger.logEvent(
      session ? { id: session.userId, email: session.email, name: '', role: session.role as UserRole, organization: 'unknown', createdAt: new Date().toISOString() } : null,
      'api.key.generate.failed',
      {
        resourceType: 'api_key',
        resourceId: 'unknown',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    )

    return NextResponse.json(
      { error: 'Failed to generate API key' },
      { status: 500 }
    )
  }
}

// List user's API keys (without exposing the actual keys)
export async function GET(request: NextRequest) {
  let session: Awaited<ReturnType<typeof getServerSession>> | null = null

  try {
    session = await getServerSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's API keys from database
    const userKeys = await apiKeyRepository.listByUser(session.userId)

    // Format for response (ensure no sensitive data)
    const formattedKeys = userKeys.map(k => ({
      id: k.id,
      name: k.name,
      prefix: k.keyPrefix,
      permissions: k.permissions,
      rateLimit: k.rateLimit,
      createdAt: k.createdAt,
      expiresAt: k.expiresAt,
      lastUsedAt: k.lastUsedAt,
      usageCount: k.usageCount,
      isActive: k.isActive,
      hasIpAllowlist: !!k.ipAllowlist && (k.ipAllowlist as string[]).length > 0
    }))

    // Audit the list operation
    await auditLogger.logEvent(
      { id: session.userId, email: session.email, name: '', role: session.role as UserRole, organization: 'unknown', createdAt: new Date().toISOString() },
      'api.key.list',
      {
        resourceType: 'api_key',
        resourceId: 'all',
        success: true,
        metadata: {
          count: formattedKeys.length
        }
      }
    )

    return NextResponse.json({ keys: formattedKeys })

  } catch (error) {
    logger.error('API key listing failed', error, { userId: session?.userId })
    return NextResponse.json(
      { error: 'Failed to list API keys' },
      { status: 500 }
    )
  }
}

// Revoke an API key
export async function DELETE(request: NextRequest) {
  let session: Awaited<ReturnType<typeof getServerSession>> | null = null

  try {
    session = await getServerSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate CSRF token
    const csrfValidation = validateCSRFToken(request, session.userId)
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

    // Revoke key using database repository
    const revoked = await apiKeyRepository.revoke(keyId, session.userId)

    if (!revoked) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    // Audit the revocation
    await auditLogger.logEvent(
      { id: session.userId, email: session.email, name: '', role: session.role as UserRole, organization: 'unknown', createdAt: new Date().toISOString() },
      'api.key.revoke',
      {
        resourceType: 'api_key',
        resourceId: keyId,
        success: true,
        metadata: {
          keyId
        }
      }
    )

    return NextResponse.json({ success: true, message: 'API key revoked' })

  } catch (error) {
    logger.error('API key revocation failed', error, { userId: session?.userId })
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    )
  }
}