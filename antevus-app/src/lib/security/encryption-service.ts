/**
 * Encryption Service for Sensitive Data Protection
 *
 * SECURITY NOTICE:
 * - AES-256-GCM encryption for data at rest
 * - Unique initialization vectors for each encryption
 * - HIPAA/GDPR compliant encryption standards
 * - Never logs sensitive data or keys
 *
 * PRODUCTION REQUIREMENTS:
 * - Use AWS KMS or HashiCorp Vault for key management
 * - Implement key rotation policy
 * - Store keys in secure environment variables
 * - Enable audit logging for all encryption operations
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { logger } from '@/lib/logger'

// Encryption configuration
const ALGORITHM = 'aes-256-gcm'
const SALT_LENGTH = 32
const IV_LENGTH = 16
const TAG_LENGTH = 16
const KEY_LENGTH = 32

// Get encryption key from environment or generate for development
const getEncryptionKey = (): Buffer => {
  const isProd = process.env.NODE_ENV === 'production'
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
  const envKey = process.env.ENCRYPTION_KEY

  // Skip validation during build phase
  if (isBuildPhase) {
    // Return a dummy key for build phase
    return Buffer.from('0'.repeat(64), 'hex')
  }

  // In production runtime, key is absolutely required
  if (!envKey && isProd && !isBuildPhase) {
    throw new Error('ENCRYPTION_KEY is required in production')
  }

  // Reject NEXT_PUBLIC_* in production for security
  if (isProd && process.env.NEXT_PUBLIC_ENCRYPTION_KEY) {
    throw new Error('NEXT_PUBLIC_ENCRYPTION_KEY must not be used server-side in production')
  }

  if (envKey) {
    // Check if it's a hex string (64 chars for 32 bytes)
    if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
      // Convert hex string to Buffer (32 bytes)
      return Buffer.from(envKey, 'hex')
    }
    // Otherwise assume base64 encoded
    return Buffer.from(envKey, 'base64')
  }

  // Development fallback - generate deterministic key
  // ONLY in development, never in production
  if (!isProd) {
    const password = 'DEVELOPMENT_ONLY_KEY_DO_NOT_USE_IN_PRODUCTION'
    const salt = Buffer.from('antevus_dev_salt_2025', 'utf8')
    logger.warn('Using development encryption key - NEVER use in production')
    return scryptSync(password, salt, KEY_LENGTH)
  }

  // Should never reach here due to earlier checks
  throw new Error('Failed to initialize encryption key')
}

class EncryptionService {
  private key: Buffer

  constructor() {
    try {
      this.key = getEncryptionKey()

      if (this.key.length !== KEY_LENGTH) {
        throw new Error(`Invalid encryption key length. Expected ${KEY_LENGTH} bytes, got ${this.key.length}`)
      }

      logger.info('Encryption service initialized', {
        algorithm: ALGORITHM,
        environment: process.env.NODE_ENV
      })
    } catch (error) {
      logger.error('Failed to initialize encryption service', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Encrypt sensitive data
   * Returns base64 encoded string containing: salt:iv:authTag:encrypted
   */
  encrypt(plaintext: string): string {
    try {
      // Generate random IV for each encryption
      const iv = randomBytes(IV_LENGTH)

      // Create cipher
      const cipher = createCipheriv(ALGORITHM, this.key, iv)

      // Encrypt data
      let encrypted = cipher.update(plaintext, 'utf8')
      encrypted = Buffer.concat([encrypted, cipher.final()])

      // Get authentication tag
      const authTag = cipher.getAuthTag()

      // Combine all components
      // Format: iv:authTag:encrypted (all base64)
      const combined = [
        iv.toString('base64'),
        authTag.toString('base64'),
        encrypted.toString('base64')
      ].join(':')

      return combined
    } catch (error) {
      logger.error('Encryption failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw new Error('Failed to encrypt data')
    }
  }

  /**
   * Decrypt sensitive data
   * Expects base64 encoded string in format: iv:authTag:encrypted
   */
  decrypt(encryptedData: string): string {
    try {
      // Parse the combined string
      const parts = encryptedData.split(':')

      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format')
      }

      const [ivBase64, authTagBase64, encryptedBase64] = parts

      // Decode from base64
      const iv = Buffer.from(ivBase64, 'base64')
      const authTag = Buffer.from(authTagBase64, 'base64')
      const encrypted = Buffer.from(encryptedBase64, 'base64')

      // Validate lengths
      if (iv.length !== IV_LENGTH) {
        throw new Error('Invalid IV length')
      }

      if (authTag.length !== TAG_LENGTH) {
        throw new Error('Invalid auth tag length')
      }

      // Create decipher
      const decipher = createDecipheriv(ALGORITHM, this.key, iv)
      decipher.setAuthTag(authTag)

      // Decrypt data
      let decrypted = decipher.update(encrypted)
      decrypted = Buffer.concat([decrypted, decipher.final()])

      return decrypted.toString('utf8')
    } catch (error) {
      logger.error('Decryption failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw new Error('Failed to decrypt data')
    }
  }

  /**
   * Encrypt an object as JSON
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  encryptObject(obj: Record<string, any>): string {
    try {
      const jsonString = JSON.stringify(obj)
      return this.encrypt(jsonString)
    } catch (error) {
      logger.error('Object encryption failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw new Error('Failed to encrypt object')
    }
  }

  /**
   * Decrypt JSON back to object
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decryptObject<T = Record<string, any>>(encryptedData: string): T {
    try {
      const jsonString = this.decrypt(encryptedData)
      return JSON.parse(jsonString) as T
    } catch (error) {
      logger.error('Object decryption failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw new Error('Failed to decrypt object')
    }
  }

  /**
   * Hash sensitive data for comparison (e.g., API keys)
   * Uses scrypt for secure hashing
   */
  hash(data: string): string {
    try {
      const salt = randomBytes(SALT_LENGTH)
      const hash = scryptSync(data, salt, 64)

      // Return salt and hash combined
      return salt.toString('base64') + ':' + hash.toString('base64')
    } catch (error) {
      logger.error('Hashing failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw new Error('Failed to hash data')
    }
  }

  /**
   * Verify hashed data
   */
  verifyHash(data: string, hashedData: string): boolean {
    try {
      const [saltBase64, hashBase64] = hashedData.split(':')

      if (!saltBase64 || !hashBase64) {
        return false
      }

      const salt = Buffer.from(saltBase64, 'base64')
      const originalHash = Buffer.from(hashBase64, 'base64')

      const hash = scryptSync(data, salt, 64)

      return hash.equals(originalHash)
    } catch (error) {
      logger.error('Hash verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return false
    }
  }

  /**
   * Generate a secure random token
   */
  generateToken(length: number = 32): string {
    return randomBytes(length).toString('base64url')
  }

  /**
   * Mask sensitive data for logging
   */
  mask(data: string, visibleChars: number = 4): string {
    if (!data || data.length <= visibleChars) {
      return '***'
    }

    const visible = data.substring(0, visibleChars)
    const masked = '*'.repeat(Math.min(data.length - visibleChars, 20))

    return `${visible}${masked}`
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService()

// Export types for use in other modules
export type { EncryptionService }