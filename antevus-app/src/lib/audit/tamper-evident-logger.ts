/**
 * Tamper-Evident Audit Logger with Blockchain-style Chaining
 * Ensures audit logs cannot be modified without detection
 * Compliant with 21 CFR Part 11 and HIPAA requirements
 */

import { createHash, createHmac } from 'crypto'
import { User } from '@/lib/auth/types'
import { prisma } from '@/lib/db/prisma'
import { logger } from '@/lib/logger'
import { AuditEvent, AuditEventType } from './logger'

// Get audit signing key from environment
function getAuditSigningKey(): string {
  const key = process.env.AUDIT_SIGNING_KEY

  if (!key) {
    if (process.env.NODE_ENV !== 'production') {
      return 'dev-audit-signing-key-min-32-characters!'
    }
    throw new Error('AUDIT_SIGNING_KEY is required in production')
  }

  if (key.length < 32) {
    throw new Error('AUDIT_SIGNING_KEY must be at least 32 characters')
  }

  return key
}

export interface TamperEvidentAuditEvent extends AuditEvent {
  hash: string           // SHA-256 hash of this event
  previousHash: string   // Hash of previous event (blockchain-style)
  signature: string      // HMAC signature for integrity
  sequenceNumber: number // Monotonic sequence number
  merkleRoot?: string    // Optional: Merkle tree root for batch verification
}

export interface AuditVerificationResult {
  valid: boolean
  errors: string[]
  brokenChainAt?: number
  tamperedEvents?: string[]
}

/**
 * Tamper-Evident Audit Logger
 */
export class TamperEvidentAuditLogger {
  private sequenceNumber: number = 0
  private previousHash: string = '0000000000000000000000000000000000000000000000000000000000000000'
  private signingKey: string

  constructor() {
    this.signingKey = getAuditSigningKey()
    this.initializeChain()
  }

  /**
   * Initialize the chain from the last stored event
   */
  private async initializeChain(): Promise<void> {
    try {
      // Get the last audit event from database
      const lastEvent = await prisma.auditEvent.findFirst({
        orderBy: { timestamp: 'desc' },
        select: {
          metadata: true
        }
      })

      if (lastEvent?.metadata) {
        const metadata = lastEvent.metadata as any
        if (metadata.hash) {
          this.previousHash = metadata.hash
        }
        if (metadata.sequenceNumber) {
          this.sequenceNumber = metadata.sequenceNumber + 1
        }
      }
    } catch (error) {
      logger.error('Failed to initialize audit chain', error)
    }
  }

  /**
   * Create hash of event data
   */
  private hashEvent(event: Omit<TamperEvidentAuditEvent, 'hash' | 'signature'>): string {
    const data = {
      id: event.id,
      timestamp: event.timestamp,
      userId: event.userId,
      eventType: event.eventType,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      success: event.success,
      errorMessage: event.errorMessage,
      details: event.details,
      previousHash: event.previousHash,
      sequenceNumber: event.sequenceNumber
    }

    // Normalize JSON for consistent hashing
    const normalized = JSON.stringify(data, Object.keys(data).sort())
    return createHash('sha256').update(normalized).digest('hex')
  }

  /**
   * Sign event data with HMAC
   */
  private signEvent(eventHash: string): string {
    return createHmac('sha256', this.signingKey)
      .update(eventHash)
      .digest('hex')
  }

  /**
   * Verify event signature
   */
  private verifySignature(eventHash: string, signature: string): boolean {
    const expectedSignature = this.signEvent(eventHash)
    // Use timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  }

  /**
   * Log an audit event with integrity protection
   */
  async logEvent(
    user: User | null,
    eventType: AuditEventType,
    details?: {
      resourceType?: string
      resourceId?: string
      success?: boolean
      errorMessage?: string
      metadata?: Record<string, unknown>
    }
  ): Promise<TamperEvidentAuditEvent> {
    try {
      // Create base event
      const baseEvent: Omit<TamperEvidentAuditEvent, 'hash' | 'signature'> = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        userId: user?.id || 'anonymous',
        userEmail: user?.email || 'anonymous',
        userName: user?.name || 'Anonymous',
        userRole: user?.role || 'none',
        eventType,
        resourceType: details?.resourceType,
        resourceId: details?.resourceId,
        details: details?.metadata,
        success: details?.success !== false,
        errorMessage: details?.errorMessage,
        ipAddress: 'server-side',
        userAgent: 'server',
        previousHash: this.previousHash,
        sequenceNumber: this.sequenceNumber
      }

      // Calculate hash
      const eventHash = this.hashEvent(baseEvent)

      // Sign the hash
      const signature = this.signEvent(eventHash)

      // Create complete event
      const event: TamperEvidentAuditEvent = {
        ...baseEvent,
        hash: eventHash,
        signature
      }

      // Store in database with all integrity data
      await prisma.auditEvent.create({
        data: {
          id: event.id,
          userId: user?.id || null,
          eventType: event.eventType,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          success: event.success,
          errorMessage: event.errorMessage,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          metadata: {
            ...event.details,
            hash: event.hash,
            previousHash: event.previousHash,
            signature: event.signature,
            sequenceNumber: event.sequenceNumber
          },
          signature: event.signature,
          previousHash: event.previousHash
        }
      })

      // Update chain state
      this.previousHash = eventHash
      this.sequenceNumber++

      // In development, log to console
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Audit event logged', {
          type: eventType,
          userId: user?.id,
          hash: eventHash.substring(0, 8) + '...',
          sequence: event.sequenceNumber
        })
      }

      return event

    } catch (error) {
      logger.error('Failed to log audit event', error, { eventType })
      throw error
    }
  }

  /**
   * Verify the integrity of the audit log chain
   */
  async verifyChain(
    startDate?: Date,
    endDate?: Date
  ): Promise<AuditVerificationResult> {
    const errors: string[] = []
    const tamperedEvents: string[] = []
    let previousHash = '0000000000000000000000000000000000000000000000000000000000000000'
    let expectedSequence = 0

    try {
      // Get events in chronological order
      const events = await prisma.auditEvent.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { timestamp: 'asc' }
      })

      for (const dbEvent of events) {
        const metadata = dbEvent.metadata as any

        // Check sequence number
        if (metadata.sequenceNumber !== expectedSequence) {
          errors.push(`Sequence number mismatch at event ${dbEvent.id}: expected ${expectedSequence}, got ${metadata.sequenceNumber}`)
        }

        // Check previous hash linkage
        if (metadata.previousHash !== previousHash) {
          errors.push(`Chain broken at event ${dbEvent.id}: previous hash mismatch`)
          return {
            valid: false,
            errors,
            brokenChainAt: expectedSequence,
            tamperedEvents
          }
        }

        // Recreate event for verification
        const eventForHash = {
          id: dbEvent.id,
          timestamp: dbEvent.timestamp.toISOString(),
          userId: dbEvent.userId,
          eventType: dbEvent.eventType,
          resourceType: dbEvent.resourceType,
          resourceId: dbEvent.resourceId,
          success: dbEvent.success,
          errorMessage: dbEvent.errorMessage,
          details: metadata,
          previousHash: metadata.previousHash,
          sequenceNumber: metadata.sequenceNumber
        }

        // Verify hash
        const calculatedHash = this.hashEvent(eventForHash as any)
        if (calculatedHash !== metadata.hash) {
          errors.push(`Hash mismatch for event ${dbEvent.id}: data has been tampered`)
          tamperedEvents.push(dbEvent.id)
        }

        // Verify signature
        if (metadata.signature) {
          const validSignature = this.verifySignature(metadata.hash, metadata.signature)
          if (!validSignature) {
            errors.push(`Invalid signature for event ${dbEvent.id}`)
            tamperedEvents.push(dbEvent.id)
          }
        }

        previousHash = metadata.hash
        expectedSequence++
      }

      return {
        valid: errors.length === 0,
        errors,
        tamperedEvents: tamperedEvents.length > 0 ? tamperedEvents : undefined
      }

    } catch (error) {
      logger.error('Chain verification failed', error)
      return {
        valid: false,
        errors: ['Verification process failed: ' + (error as Error).message]
      }
    }
  }

  /**
   * Create a Merkle tree root for a batch of events
   * Used for efficient verification of large audit logs
   */
  createMerkleRoot(events: TamperEvidentAuditEvent[]): string {
    if (events.length === 0) return ''

    // Get hashes of all events
    let hashes = events.map(e => e.hash)

    // Build Merkle tree
    while (hashes.length > 1) {
      const newLevel: string[] = []

      for (let i = 0; i < hashes.length; i += 2) {
        const left = hashes[i]
        const right = hashes[i + 1] || left // Duplicate last if odd number

        const combined = createHash('sha256')
          .update(left + right)
          .digest('hex')

        newLevel.push(combined)
      }

      hashes = newLevel
    }

    return hashes[0]
  }

  /**
   * Export audit logs with integrity proof
   */
  async exportWithProof(
    startDate: Date,
    endDate: Date
  ): Promise<{
    events: any[]
    proof: {
      merkleRoot: string
      chainValid: boolean
      signature: string
      timestamp: string
    }
  }> {
    const events = await prisma.auditEvent.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { timestamp: 'asc' }
    })

    // Verify chain integrity
    const verification = await this.verifyChain(startDate, endDate)

    // Create Merkle root
    const merkleRoot = this.createMerkleRoot(events as any)

    // Sign the export
    const exportSignature = createHmac('sha256', this.signingKey)
      .update(merkleRoot + startDate.toISOString() + endDate.toISOString())
      .digest('hex')

    return {
      events,
      proof: {
        merkleRoot,
        chainValid: verification.valid,
        signature: exportSignature,
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Periodic integrity check (should be run regularly)
   */
  async performIntegrityCheck(): Promise<void> {
    const result = await this.verifyChain()

    if (!result.valid) {
      // Critical: Audit log tampering detected
      logger.fatal('AUDIT LOG TAMPERING DETECTED', {
        errors: result.errors,
        tamperedEvents: result.tamperedEvents
      })

      // Send alerts to security team
      // In production, this would trigger immediate notifications
      await this.sendSecurityAlert({
        severity: 'CRITICAL',
        message: 'Audit log tampering detected',
        details: result
      })
    }
  }

  /**
   * Send security alert (placeholder for production implementation)
   */
  private async sendSecurityAlert(alert: any): Promise<void> {
    logger.error('SECURITY ALERT', alert)
    // In production: Send to SIEM, PagerDuty, email security team, etc.
  }
}

// Export singleton instance
export const tamperEvidentAuditLogger = new TamperEvidentAuditLogger()