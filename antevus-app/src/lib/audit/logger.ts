import { User } from '@/lib/auth/types'

export type AuditEventType =
  | 'user.login'
  | 'user.logout'
  | 'user.failed_login'
  | 'instrument.view'
  | 'instrument.start'
  | 'instrument.stop'
  | 'data.export'
  | 'data.view'
  | 'settings.update'
  | 'user.create'
  | 'user.update'
  | 'user.delete'

export interface AuditEvent {
  id: string
  timestamp: string
  userId: string
  userEmail: string
  userName: string
  userRole: string
  eventType: AuditEventType
  resourceType?: string
  resourceId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  success: boolean
  errorMessage?: string
}

class AuditLogger {
  private events: AuditEvent[] = []

  /**
   * Log an audit event
   * In production, this would send to a secure audit log service
   */
  logEvent(
    user: User | null,
    eventType: AuditEventType,
    details?: {
      resourceType?: string
      resourceId?: string
      success?: boolean
      errorMessage?: string
      metadata?: Record<string, unknown>
    }
  ) {
    const event: AuditEvent = {
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
      // In production, these would be captured server-side
      ipAddress: 'client-ip',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown'
    }

    // Store locally (in production, send to server)
    this.events.push(event)

    // Also log to console for debugging
    console.log('[AUDIT]', {
      type: eventType,
      user: user?.email,
      success: event.success,
      details: details?.metadata
    })

    // In production, send to backend
    // await fetch('/api/audit', { method: 'POST', body: JSON.stringify(event) })
  }

  /**
   * Get audit events (for demo purposes)
   * In production, this would query the backend
   */
  getEvents(filters?: {
    userId?: string
    eventType?: AuditEventType
    startDate?: Date
    endDate?: Date
  }): AuditEvent[] {
    let filtered = [...this.events]

    if (filters?.userId) {
      filtered = filtered.filter(e => e.userId === filters.userId)
    }
    if (filters?.eventType) {
      filtered = filtered.filter(e => e.eventType === filters.eventType)
    }
    if (filters?.startDate) {
      filtered = filtered.filter(e => new Date(e.timestamp) >= filters.startDate!)
    }
    if (filters?.endDate) {
      filtered = filtered.filter(e => new Date(e.timestamp) <= filters.endDate!)
    }

    return filtered.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }

  /**
   * Export audit logs (for compliance)
   */
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    const events = this.getEvents()

    if (format === 'json') {
      return JSON.stringify(events, null, 2)
    }

    // CSV export
    const headers = [
      'ID', 'Timestamp', 'User ID', 'User Email', 'User Name', 'Role',
      'Event Type', 'Resource Type', 'Resource ID', 'Success', 'Error Message'
    ]

    const rows = events.map(e => [
      e.id,
      e.timestamp,
      e.userId,
      e.userEmail,
      e.userName,
      e.userRole,
      e.eventType,
      e.resourceType || '',
      e.resourceId || '',
      e.success.toString(),
      e.errorMessage || ''
    ])

    return [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${c}"`).join(','))
    ].join('\n')
  }
}

// Singleton instance
export const auditLogger = new AuditLogger()