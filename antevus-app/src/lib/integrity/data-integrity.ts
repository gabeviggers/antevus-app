/**
 * Data Integrity Controls with Checksums
 * Ensures data hasn't been tampered with or corrupted
 * Compliant with 21 CFR Part 11 and GxP requirements
 */

import { createHash, createHmac } from 'crypto'
import { promises as fs } from 'fs'
import { logger } from '@/lib/logger'
import { encryptionService } from '@/lib/security/encryption'

// Supported checksum algorithms
export type ChecksumAlgorithm = 'sha256' | 'sha512' | 'md5' | 'crc32'

// Integrity verification results
export interface IntegrityVerificationResult {
  valid: boolean
  algorithm: ChecksumAlgorithm
  expectedChecksum: string
  actualChecksum: string
  timestamp: Date
  errors?: string[]
}

// Metadata for integrity tracking
export interface IntegrityMetadata {
  checksum: string
  algorithm: ChecksumAlgorithm
  createdAt: Date
  createdBy: string
  version: string
  size: number
  contentType?: string
  signature?: string // Optional digital signature
}

// Data backup metadata
export interface BackupMetadata {
  id: string
  timestamp: Date
  checksum: string
  size: number
  location: string
  encrypted: boolean
  verified: boolean
  verificationDate?: Date
}

/**
 * Data Integrity Service
 */
export class DataIntegrityService {
  private readonly version = '1.0'
  private readonly defaultAlgorithm: ChecksumAlgorithm = 'sha256'

  /**
   * Generate checksum for data
   */
  generateChecksum(
    data: string | Buffer | object,
    algorithm: ChecksumAlgorithm = this.defaultAlgorithm
  ): string {
    // Convert data to buffer
    let buffer: Buffer
    if (typeof data === 'string') {
      buffer = Buffer.from(data, 'utf8')
    } else if (Buffer.isBuffer(data)) {
      buffer = data
    } else {
      // For objects, normalize JSON first
      const normalized = this.normalizeJSON(data)
      buffer = Buffer.from(JSON.stringify(normalized), 'utf8')
    }

    // Generate checksum based on algorithm
    switch (algorithm) {
      case 'sha256':
      case 'sha512':
      case 'md5':
        return createHash(algorithm).update(buffer).digest('hex')

      case 'crc32':
        return this.crc32(buffer).toString(16)

      default:
        throw new Error(`Unsupported algorithm: ${algorithm}`)
    }
  }

  /**
   * Verify data integrity
   */
  verifyIntegrity(
    data: string | Buffer | object,
    expectedChecksum: string,
    algorithm: ChecksumAlgorithm = this.defaultAlgorithm
  ): IntegrityVerificationResult {
    const actualChecksum = this.generateChecksum(data, algorithm)
    const valid = actualChecksum === expectedChecksum

    const result: IntegrityVerificationResult = {
      valid,
      algorithm,
      expectedChecksum,
      actualChecksum,
      timestamp: new Date(),
      errors: valid ? undefined : ['Checksum mismatch - data may be corrupted or tampered']
    }

    // Log verification attempt
    if (!valid) {
      logger.warn('Data integrity verification failed', { ...result })
    }

    return result
  }

  /**
   * Create integrity metadata for data
   */
  createIntegrityMetadata(
    data: string | Buffer | object,
    userId: string,
    contentType?: string
  ): IntegrityMetadata {
    const size = this.getDataSize(data)
    const checksum = this.generateChecksum(data)

    const metadata: IntegrityMetadata = {
      checksum,
      algorithm: this.defaultAlgorithm,
      createdAt: new Date(),
      createdBy: userId,
      version: this.version,
      size,
      contentType
    }

    // Add digital signature if signing key is available
    const signingKey = process.env.DATA_SIGNING_KEY
    if (signingKey) {
      metadata.signature = this.signData(checksum, signingKey)
    }

    return metadata
  }

  /**
   * Verify integrity metadata
   */
  verifyIntegrityMetadata(
    data: string | Buffer | object,
    metadata: IntegrityMetadata
  ): IntegrityVerificationResult {
    const result = this.verifyIntegrity(data, metadata.checksum, metadata.algorithm)

    // Verify signature if present
    if (metadata.signature) {
      const signingKey = process.env.DATA_SIGNING_KEY
      if (signingKey) {
        const expectedSignature = this.signData(metadata.checksum, signingKey)
        if (metadata.signature !== expectedSignature) {
          result.valid = false
          result.errors = result.errors || []
          result.errors.push('Digital signature verification failed')
        }
      }
    }

    // Verify size
    const actualSize = this.getDataSize(data)
    if (actualSize !== metadata.size) {
      result.valid = false
      result.errors = result.errors || []
      result.errors.push(`Size mismatch: expected ${metadata.size}, got ${actualSize}`)
    }

    return result
  }

  /**
   * Create secure backup with integrity protection
   */
  async createBackup<T>(
    data: T,
    userId: string,
    encrypt: boolean = true
  ): Promise<BackupMetadata> {
    try {
      // Generate backup ID
      const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Create integrity metadata
      const integrityMetadata = this.createIntegrityMetadata(data as string | object | Buffer, userId, 'backup')

      // Prepare backup data
      const backupData = {
        data,
        integrity: integrityMetadata,
        timestamp: new Date().toISOString(),
        userId
      }

      // Encrypt if requested
      let finalData: string
      if (encrypt) {
        const encrypted = encryptionService.encrypt(backupData)
        finalData = JSON.stringify(encrypted)
      } else {
        finalData = JSON.stringify(backupData)
      }

      // Calculate final checksum
      const finalChecksum = this.generateChecksum(finalData)

      // Store backup (in production, this would go to S3/GCS)
      const location = await this.storeBackup(backupId, finalData)

      // Create backup metadata
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: new Date(),
        checksum: finalChecksum,
        size: Buffer.byteLength(finalData),
        location,
        encrypted: encrypt,
        verified: false
      }

      // Store metadata in database
      await this.storeBackupMetadata(metadata)

      logger.info('Backup created', { backupId, size: metadata.size })

      return metadata

    } catch (error) {
      logger.error('Backup creation failed', error)
      throw new Error('Failed to create backup')
    }
  }

  /**
   * Restore backup with integrity verification
   */
  async restoreBackup<T>(backupId: string): Promise<T> {
    try {
      // Get backup metadata
      const metadata = await this.getBackupMetadata(backupId)
      if (!metadata) {
        throw new Error('Backup not found')
      }

      // Retrieve backup data
      const backupData = await this.retrieveBackup(metadata.location)

      // Verify integrity
      const integrityCheck = this.verifyIntegrity(
        backupData,
        metadata.checksum,
        'sha256'
      )

      if (!integrityCheck.valid) {
        throw new Error('Backup integrity check failed: ' + integrityCheck.errors?.join(', '))
      }

      // Parse backup data
      let parsedData: { data: unknown; integrity: IntegrityMetadata }
      if (metadata.encrypted) {
        const encrypted = JSON.parse(backupData)
        const decrypted = encryptionService.decrypt(encrypted)
        parsedData = JSON.parse(decrypted)
      } else {
        parsedData = JSON.parse(backupData)
      }

      // Verify internal integrity
      const internalCheck = this.verifyIntegrityMetadata(
        parsedData.data as string | object | Buffer,
        parsedData.integrity
      )

      if (!internalCheck.valid) {
        throw new Error('Backup data integrity check failed')
      }

      // Update verification status
      await this.updateBackupMetadata(backupId, {
        verified: true,
        verificationDate: new Date()
      })

      logger.info('Backup restored successfully', { backupId })

      return parsedData.data as T

    } catch (error) {
      logger.error('Backup restoration failed', error, { backupId })
      throw error
    }
  }

  /**
   * Verify all backups (maintenance task)
   */
  async verifyAllBackups(): Promise<{
    total: number
    valid: number
    corrupted: string[]
  }> {
    const backups = await this.getAllBackupMetadata()
    const corrupted: string[] = []
    let valid = 0

    for (const backup of backups) {
      try {
        const data = await this.retrieveBackup(backup.location)
        const result = this.verifyIntegrity(data, backup.checksum)

        if (result.valid) {
          valid++
          await this.updateBackupMetadata(backup.id, {
            verified: true,
            verificationDate: new Date()
          })
        } else {
          corrupted.push(backup.id)
          logger.error('Corrupted backup detected', { backupId: backup.id })
        }
      } catch (error) {
        corrupted.push(backup.id)
        logger.error('Backup verification failed', error, { backupId: backup.id })
      }
    }

    return {
      total: backups.length,
      valid,
      corrupted
    }
  }

  /**
   * Create checksum for file chunks (for large files)
   */
  async createChunkedChecksum(
    filePath: string,
    chunkSize: number = 1024 * 1024 // 1MB chunks
  ): Promise<{
    fileChecksum: string
    chunkChecksums: string[]
    totalSize: number
  }> {
    // In production, this would read file in chunks
    // For now, simplified implementation
    const fileBuffer = await fs.readFile(filePath)

    const chunkChecksums: string[] = []
    const chunks = Math.ceil(fileBuffer.length / chunkSize)

    for (let i = 0; i < chunks; i++) {
      const start = i * chunkSize
      const end = Math.min(start + chunkSize, fileBuffer.length)
      const chunk = fileBuffer.slice(start, end)
      chunkChecksums.push(this.generateChecksum(chunk))
    }

    return {
      fileChecksum: this.generateChecksum(fileBuffer),
      chunkChecksums,
      totalSize: fileBuffer.length
    }
  }

  /**
   * Normalize JSON for consistent hashing
   */
  private normalizeJSON(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') return obj

    if (Array.isArray(obj)) {
      return obj.map(item => this.normalizeJSON(item))
    }

    const sorted: Record<string, unknown> = {}
    const keys = Object.keys(obj).sort()

    for (const key of keys) {
      sorted[key] = this.normalizeJSON((obj as Record<string, unknown>)[key])
    }

    return sorted
  }

  /**
   * Get data size in bytes
   */
  private getDataSize(data: string | Buffer | object): number {
    if (typeof data === 'string') {
      return Buffer.byteLength(data, 'utf8')
    } else if (Buffer.isBuffer(data)) {
      return data.length
    } else {
      return Buffer.byteLength(JSON.stringify(data), 'utf8')
    }
  }

  /**
   * Sign data with HMAC
   */
  private signData(data: string, key: string): string {
    return createHmac('sha256', key).update(data).digest('hex')
  }

  /**
   * CRC32 implementation
   */
  private crc32(buffer: Buffer): number {
    const table = this.getCRC32Table()
    let crc = 0xFFFFFFFF

    for (let i = 0; i < buffer.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buffer[i]) & 0xFF]
    }

    return (crc ^ 0xFFFFFFFF) >>> 0
  }

  /**
   * Get CRC32 lookup table
   */
  private getCRC32Table(): Uint32Array {
    const table = new Uint32Array(256)

    for (let i = 0; i < 256; i++) {
      let c = i
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
      }
      table[i] = c
    }

    return table
  }

  /**
   * Store backup data (placeholder - would use S3/GCS in production)
   */
  private async storeBackup(backupId: string, _data: string): Promise<string> {
    // In production, store to S3/GCS
    // For now, return a mock location
    return `s3://backups/${backupId}`
  }

  /**
   * Retrieve backup data
   */
  private async retrieveBackup(_location: string): Promise<string> {
    // In production, retrieve from S3/GCS
    // For now, return mock data
    return '{"data":"mock","integrity":{}}'
  }

  /**
   * Store backup metadata in database
   */
  private async storeBackupMetadata(metadata: BackupMetadata): Promise<void> {
    // In production, store in database
    logger.debug('Backup metadata stored', { id: metadata.id })
  }

  /**
   * Get backup metadata
   */
  private async getBackupMetadata(_backupId: string): Promise<BackupMetadata | null> {
    // In production, retrieve from database
    return null
  }

  /**
   * Get all backup metadata
   */
  private async getAllBackupMetadata(): Promise<BackupMetadata[]> {
    // In production, retrieve from database
    return []
  }

  /**
   * Update backup metadata
   */
  private async updateBackupMetadata(
    backupId: string,
    updates: Partial<BackupMetadata>
  ): Promise<void> {
    // In production, update in database
    logger.debug('Backup metadata updated', { id: backupId, updates })
  }
}

// Export singleton instance
export const dataIntegrityService = new DataIntegrityService()

/**
 * Middleware for automatic integrity checking
 */
interface IntegrityRequest {
  body?: unknown
}

interface IntegrityResponse {
  send: (data: unknown) => unknown
  setHeader: (name: string, value: string) => void
}

type IntegrityNext = () => void

export function integrityMiddleware() {
  return async (_req: IntegrityRequest, res: IntegrityResponse & Record<string, unknown>, next: IntegrityNext) => {
    // Add integrity metadata to response
    const originalSend = res.send

    res.send = function(data: unknown) {
      if (typeof data === 'object' && data !== null) {
        const checksum = dataIntegrityService.generateChecksum(data)
        res.setHeader('X-Data-Checksum', checksum)
        res.setHeader('X-Checksum-Algorithm', 'sha256')
      }
      return originalSend.call(this, data)
    }

    next()
  }
}