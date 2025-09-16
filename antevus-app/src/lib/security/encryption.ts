/**
 * AES-256-GCM Encryption Service
 * Production-ready encryption for data at rest
 * Compliant with HIPAA and SOC 2 requirements
 */

import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto'
import { logger } from '@/lib/logger'

// Encryption configuration
const ALGORITHM = 'aes-256-gcm'
const SALT_LENGTH = 64
const IV_LENGTH = 16
// const TAG_LENGTH = 16 // Currently unused but kept for reference
const ITERATIONS = 100000
const KEY_LENGTH = 32

// Get encryption key from environment
function getEncryptionKey(): string {
  const key = process.env.API_KEY_ENCRYPTION_KEY

  if (!key) {
    if (process.env.NODE_ENV !== 'production') {
      logger.warn('Using development encryption key')
      return 'DEV_ONLY_KEY_0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
    }
    throw new Error('API_KEY_ENCRYPTION_KEY is required in production')
  }

  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('API_KEY_ENCRYPTION_KEY must be a 64-character hex string')
  }

  return key
}

export interface EncryptedData {
  encrypted: string
  salt: string
  iv: string
  tag: string
  algorithm: string
  iterations: number
  timestamp: string
}

export interface EncryptionMetadata {
  version: string
  keyId?: string
  purpose?: string
}

/**
 * Encryption service for sensitive data
 */
export class EncryptionService {
  private readonly version = '1.0'

  /**
   * Derive encryption key from password and salt
   */
  private deriveKey(password: string, salt: Buffer): Buffer {
    return pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256')
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  encrypt(
    data: string | object,
    metadata?: EncryptionMetadata
  ): EncryptedData {
    try {
      // Convert data to string if object
      const plaintext = typeof data === 'string' ? data : JSON.stringify(data)

      // Generate salt and IV
      const salt = randomBytes(SALT_LENGTH)
      const iv = randomBytes(IV_LENGTH)

      // Derive key from master password
      const password = getEncryptionKey()
      const key = this.deriveKey(password, salt)

      // Create cipher
      const cipher = createCipheriv(ALGORITHM, key, iv)

      // Add metadata as additional authenticated data (AAD)
      if (metadata) {
        cipher.setAAD(Buffer.from(JSON.stringify(metadata)), {
          plaintextLength: Buffer.byteLength(plaintext)
        })
      }

      // Encrypt data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex')
      encrypted += cipher.final('hex')

      // Get authentication tag
      const tag = cipher.getAuthTag()

      return {
        encrypted,
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        algorithm: ALGORITHM,
        iterations: ITERATIONS,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      logger.error('Encryption failed', error)
      throw new Error('Failed to encrypt data')
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  decrypt(
    encryptedData: EncryptedData,
    metadata?: EncryptionMetadata
  ): string {
    try {
      // Convert hex strings back to buffers
      const salt = Buffer.from(encryptedData.salt, 'hex')
      const iv = Buffer.from(encryptedData.iv, 'hex')
      const tag = Buffer.from(encryptedData.tag, 'hex')

      // Derive key from master password
      const password = getEncryptionKey()
      const key = this.deriveKey(password, salt)

      // Create decipher
      const decipher = createDecipheriv(ALGORITHM, key, iv)
      decipher.setAuthTag(tag)

      // Add metadata as AAD if provided
      if (metadata) {
        decipher.setAAD(Buffer.from(JSON.stringify(metadata)))
      }

      // Decrypt data
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')

      return decrypted
    } catch (error) {
      logger.error('Decryption failed', error)
      throw new Error('Failed to decrypt data')
    }
  }

  /**
   * Encrypt JSON object
   */
  encryptJSON<T>(data: T, metadata?: EncryptionMetadata): EncryptedData {
    return this.encrypt(JSON.stringify(data), metadata)
  }

  /**
   * Decrypt JSON object
   */
  decryptJSON<T>(
    encryptedData: EncryptedData,
    metadata?: EncryptionMetadata
  ): T {
    const decrypted = this.decrypt(encryptedData, metadata)
    return JSON.parse(decrypted) as T
  }

  /**
   * Encrypt sensitive fields in an object
   */
  encryptFields<T extends Record<string, unknown>>(
    obj: T,
    fieldsToEncrypt: (keyof T)[]
  ): T & { _encrypted: Record<string, EncryptedData> } {
    const result = { ...obj } as T & { _encrypted: Record<string, EncryptedData> }
    result._encrypted = {}

    for (const field of fieldsToEncrypt) {
      if (obj[field] !== undefined) {
        const metadata: EncryptionMetadata = {
          version: this.version,
          purpose: `field:${String(field)}`
        }

        result._encrypted[String(field)] = this.encrypt(obj[field] as string | object, metadata)
        delete result[field]
      }
    }

    return result
  }

  /**
   * Decrypt sensitive fields in an object
   */
  decryptFields<T extends Record<string, unknown>>(
    obj: T & { _encrypted?: Record<string, EncryptedData> }
  ): T {
    if (!obj._encrypted) {
      return obj
    }

    const result = { ...obj }
    delete result._encrypted

    for (const [field, encryptedData] of Object.entries(obj._encrypted)) {
      const metadata: EncryptionMetadata = {
        version: this.version,
        purpose: `field:${field}`
      }

      result[field as keyof T] = this.decrypt(encryptedData, metadata) as T[keyof T]
    }

    return result
  }

  /**
   * Rotate encryption key (re-encrypt with new key)
   */
  async rotateKey(
    encryptedData: EncryptedData,
    newKey: string,
    metadata?: EncryptionMetadata
  ): Promise<EncryptedData> {
    // Decrypt with old key
    const decrypted = this.decrypt(encryptedData, metadata)

    // Store old key temporarily
    const oldKey = process.env.API_KEY_ENCRYPTION_KEY
    process.env.API_KEY_ENCRYPTION_KEY = newKey

    try {
      // Re-encrypt with new key
      const reencrypted = this.encrypt(decrypted, metadata)
      return reencrypted
    } finally {
      // Restore old key
      process.env.API_KEY_ENCRYPTION_KEY = oldKey
    }
  }

  /**
   * Generate a new encryption key
   */
  static generateKey(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * Verify data integrity using authentication tag
   */
  verifyIntegrity(encryptedData: EncryptedData): boolean {
    try {
      // Attempt to decrypt - will fail if tampered
      this.decrypt(encryptedData)
      return true
    } catch {
      return false
    }
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService()

/**
 * Encrypt sensitive database fields before storage
 */
export function encryptDatabaseField(value: string | null): string | null {
  if (!value) return null

  try {
    const encrypted = encryptionService.encrypt(value)
    // Store as JSON string in database
    return JSON.stringify(encrypted)
  } catch (error) {
    logger.error('Failed to encrypt database field', error)
    throw error
  }
}

/**
 * Decrypt sensitive database fields after retrieval
 */
export function decryptDatabaseField(encryptedValue: string | null): string | null {
  if (!encryptedValue) return null

  try {
    const encrypted = JSON.parse(encryptedValue) as EncryptedData
    return encryptionService.decrypt(encrypted)
  } catch (error) {
    logger.error('Failed to decrypt database field', error)
    throw error
  }
}

/**
 * Middleware for automatic encryption/decryption of sensitive fields
 */
export function createEncryptionMiddleware(fieldsToEncrypt: string[]) {
  return {
    async beforeCreate(data: Record<string, unknown>) {
      for (const field of fieldsToEncrypt) {
        if (data[field]) {
          data[field] = encryptDatabaseField(data[field] as string | null)
        }
      }
      return data
    },

    async afterFind(data: unknown) {
      if (!data) return data

      const decrypt = (item: Record<string, unknown>) => {
        for (const field of fieldsToEncrypt) {
          if (item[field]) {
            item[field] = decryptDatabaseField(item[field] as string | null)
          }
        }
        return item
      }

      return Array.isArray(data) ? data.map(decrypt) : decrypt(data as Record<string, unknown>)
    }
  }
}