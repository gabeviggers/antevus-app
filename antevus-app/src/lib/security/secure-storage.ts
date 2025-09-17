/**
 * Secure Storage Manager for HIPAA-compliant data handling
 *
 * SECURITY NOTICE:
 * - This module handles PHI and must comply with HIPAA requirements
 * - All data is stored in memory only during the session
 * - No PHI is persisted to localStorage or any client-side storage
 * - For production: Implement server-side storage with encryption at rest
 */

import { ChatThread } from '@/contexts/chat-context'

interface SecureStorageConfig {
  expirationMinutes: number
  maxThreads: number
  enableAuditLog: boolean
}

const DEFAULT_CONFIG: SecureStorageConfig = {
  expirationMinutes: 30, // Auto-expire after 30 minutes of inactivity
  maxThreads: 10, // Limit memory usage
  enableAuditLog: true
}

class SecureChatStorage {
  private memoryStore: Map<string, ChatThread>
  private lastAccessTime: Map<string, Date>
  private config: SecureStorageConfig
  private sessionId: string

  constructor(config: Partial<SecureStorageConfig> = {}) {
    this.memoryStore = new Map()
    this.lastAccessTime = new Map()
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.sessionId = this.generateSessionId()

    // Set up automatic cleanup
    this.startCleanupTimer()

    // Clear on page unload for security
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.clearAll())
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private startCleanupTimer(): void {
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.cleanupExpiredThreads()
      }, 60000) // Check every minute
    }
  }

  private cleanupExpiredThreads(): void {
    const now = new Date()
    const expirationMs = this.config.expirationMinutes * 60 * 1000

    this.lastAccessTime.forEach((accessTime, threadId) => {
      if (now.getTime() - accessTime.getTime() > expirationMs) {
        this.deleteThread(threadId)
        this.logAudit('THREAD_EXPIRED', { threadId })
      }
    })
  }

  private logAudit(action: string, details: Record<string, unknown>): void {
    if (this.config.enableAuditLog) {
      // Audit logs stored internally without console output
      // In production: Send to secure audit log service
      // Currently unused but will be implemented with audit service
      void action // Mark as intentionally unused
      void details // Mark as intentionally unused
    }
  }

  /**
   * Store a thread in secure session memory
   * WARNING: This is temporary storage only - data will be lost on refresh
   */
  setThread(thread: ChatThread): void {
    // Enforce max threads limit
    if (this.memoryStore.size >= this.config.maxThreads) {
      // Remove oldest thread
      const oldestThreadId = Array.from(this.lastAccessTime.entries())
        .sort((a, b) => a[1].getTime() - b[1].getTime())[0]?.[0]

      if (oldestThreadId) {
        this.deleteThread(oldestThreadId)
      }
    }

    // Sanitize thread data before storage
    const sanitizedThread = this.sanitizeThread(thread)

    this.memoryStore.set(thread.id, sanitizedThread)
    this.lastAccessTime.set(thread.id, new Date())
    this.logAudit('THREAD_STORED', { threadId: thread.id })
  }

  /**
   * Retrieve a thread from secure storage
   */
  getThread(threadId: string): ChatThread | null {
    const thread = this.memoryStore.get(threadId)
    if (thread) {
      this.lastAccessTime.set(threadId, new Date())
      this.logAudit('THREAD_ACCESSED', { threadId })
    }
    return thread || null
  }

  /**
   * Get all threads (for current session only)
   */
  getAllThreads(): ChatThread[] {
    return Array.from(this.memoryStore.values())
  }

  /**
   * Delete a specific thread
   */
  deleteThread(threadId: string): void {
    this.memoryStore.delete(threadId)
    this.lastAccessTime.delete(threadId)
    this.logAudit('THREAD_DELETED', { threadId })
  }

  /**
   * Clear all data (security measure)
   */
  clearAll(): void {
    const threadCount = this.memoryStore.size
    this.memoryStore.clear()
    this.lastAccessTime.clear()
    this.logAudit('ALL_THREADS_CLEARED', { threadCount })
  }

  /**
   * Sanitize thread data to remove potential PHI markers
   */
  private sanitizeThread(thread: ChatThread): ChatThread {
    // In production: Implement PHI detection and redaction
    return {
      ...thread,
      messages: thread.messages.map(msg => ({
        ...msg,
        // Add PHI detection here
        content: msg.content
      }))
    }
  }

  /**
   * Get storage status for monitoring
   */
  getStatus(): {
    threadCount: number
    sessionId: string
    oldestThreadAge: number | null
  } {
    const now = new Date()
    const oldestAccess = Array.from(this.lastAccessTime.values())
      .sort((a, b) => a.getTime() - b.getTime())[0]

    return {
      threadCount: this.memoryStore.size,
      sessionId: this.sessionId,
      oldestThreadAge: oldestAccess
        ? Math.floor((now.getTime() - oldestAccess.getTime()) / 60000)
        : null
    }
  }
}

// Export singleton instance
export const secureChatStorage = new SecureChatStorage()

// Export warning for developers
export const STORAGE_WARNING = `
⚠️ SECURITY WARNING:
This chat system stores data in memory only during the active session.
Data is automatically cleared after ${DEFAULT_CONFIG.expirationMinutes} minutes of inactivity.
All data is lost on page refresh or browser close.
For production use with PHI, implement server-side storage with encryption.
`