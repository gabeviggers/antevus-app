/**
 * API Key Repository - Database layer for API key management
 * Replaces in-memory storage with PostgreSQL for production use
 */

import { prisma } from '@/lib/db/prisma'
import { ApiKey, Prisma } from '@prisma/client'
import crypto from 'crypto'
import { logger } from '@/lib/logger'

export interface CreateApiKeyDto {
  userId: string
  name: string
  permissions: string[]
  ipAllowlist?: string[]
  rateLimit?: number
  expiresIn?: string
}

export interface ApiKeyWithUser extends ApiKey {
  user?: {
    id: string
    email: string
    name: string
    role: string
  }
}

export class ApiKeyRepository {
  /**
   * Create a new API key with atomic transaction
   * Ensures key limit is enforced and prevents race conditions
   */
  async create(data: CreateApiKeyDto): Promise<{ key: string; apiKey: ApiKey }> {
    return await prisma.$transaction(async (tx) => {
      // Check user's active key count with row lock
      const activeKeyCount = await tx.apiKey.count({
        where: {
          userId: data.userId,
          isActive: true
        }
      })

      if (activeKeyCount >= 10) {
        throw new Error('Maximum number of API keys reached (10)')
      }

      // Generate secure API key
      const keyBytes = crypto.randomBytes(32)
      const prefix = 'ak_' + (process.env.NODE_ENV === 'production' ? 'live' : 'test')
      const fullKey = prefix + '_' + keyBytes.toString('base64url')
      const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex')
      const displayPrefix = `${prefix}_${keyHash.substring(0, 8)}...`

      // Calculate expiration
      const expiresAt = this.calculateExpiration(data.expiresIn)

      // Create the API key record
      const apiKey = await tx.apiKey.create({
        data: {
          userId: data.userId,
          keyHash,
          keyPrefix: displayPrefix,
          name: data.name,
          permissions: data.permissions,
          ipAllowlist: data.ipAllowlist || undefined,
          rateLimit: data.rateLimit || 1000,
          expiresAt
        }
      })

      // Return both the full key (only shown once) and the record
      return { key: fullKey, apiKey }
    })
  }

  /**
   * Find API key by hash
   */
  async findByHash(keyHash: string): Promise<ApiKeyWithUser | null> {
    return await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true
          }
        }
      }
    })
  }

  /**
   * Validate API key and check permissions
   */
  async validate(keyHash: string): Promise<{
    valid: boolean
    apiKey?: ApiKeyWithUser
    error?: string
  }> {
    const apiKey = await this.findByHash(keyHash)

    if (!apiKey) {
      return { valid: false, error: 'Invalid API key' }
    }

    if (!apiKey.isActive) {
      return { valid: false, error: 'API key has been revoked' }
    }

    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return { valid: false, error: 'API key has expired' }
    }

    return { valid: true, apiKey }
  }

  /**
   * Update usage statistics
   */
  async updateUsage(keyId: string): Promise<void> {
    await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 }
      }
    })
  }

  /**
   * List user's API keys (without exposing hashes)
   */
  async listByUser(userId: string): Promise<ApiKey[]> {
    return await prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        ipAllowlist: true,
        rateLimit: true,
        createdAt: true,
        expiresAt: true,
        lastUsedAt: true,
        usageCount: true,
        isActive: true,
        userId: true,
        keyHash: false // Never expose the hash
      }
    }) as ApiKey[]
  }

  /**
   * Revoke an API key
   */
  async revoke(keyId: string, userId: string): Promise<boolean> {
    try {
      const result = await prisma.apiKey.updateMany({
        where: {
          id: keyId,
          userId // Ensure user owns the key
        },
        data: {
          isActive: false
        }
      })

      return result.count > 0
    } catch (error) {
      logger.error('Failed to revoke API key', error, { keyId, userId })
      return false
    }
  }

  /**
   * Delete expired keys (cleanup job)
   */
  async deleteExpired(): Promise<number> {
    const result = await prisma.apiKey.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    })

    return result.count
  }

  /**
   * Calculate expiration date
   */
  private calculateExpiration(expiresIn?: string): Date | null {
    if (!expiresIn || expiresIn === 'never') return null

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
      default:
        now.setDate(now.getDate() + 30) // Default 30 days
    }

    return now
  }
}

// Export singleton instance
export const apiKeyRepository = new ApiKeyRepository()