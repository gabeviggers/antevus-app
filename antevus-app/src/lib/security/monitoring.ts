/**
 * Security Monitoring and SIEM Integration
 * Real-time threat detection and security event management
 * Integrates with Splunk, ELK Stack, DataDog, etc.
 */

import { logger } from '@/lib/logger'
import { tamperEvidentAuditLogger } from '@/lib/audit/tamper-evident-logger'
import { prisma } from '@/lib/db/prisma'

// Security event types
export type SecurityEventType =
  | 'authentication.failed'
  | 'authentication.brute_force'
  | 'authorization.violation'
  | 'api.rate_limit_exceeded'
  | 'api.suspicious_pattern'
  | 'data.unauthorized_access'
  | 'data.exfiltration_attempt'
  | 'session.hijacking_attempt'
  | 'csrf.attack_detected'
  | 'sql_injection_attempt'
  | 'xss_attempt'
  | 'path_traversal_attempt'
  | 'malware.detected'
  | 'compliance.violation'
  | 'audit.tampering_detected'

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical'

export interface SecurityEvent {
  id: string
  timestamp: Date
  type: SecurityEventType
  severity: SeverityLevel
  userId?: string
  ipAddress?: string
  userAgent?: string
  details: Record<string, unknown>
  indicators: string[] // Indicators of compromise
  mitigationTaken?: string
  falsePositive?: boolean
}

export interface ThreatIntelligence {
  ipReputation: Map<string, number> // IP -> threat score (0-100)
  knownBadActors: Set<string>
  suspiciousPatterns: RegExp[]
  blockedUserAgents: RegExp[]
}

export interface SecurityMetrics {
  failedLogins: number
  blockedRequests: number
  suspiciousActivities: number
  criticalEvents: number
  meanTimeToDetect: number // milliseconds
  meanTimeToRespond: number // milliseconds
}

/**
 * Security monitoring configuration
 */
interface MonitoringConfig {
  enableRealTimeAlerts: boolean
  siemEndpoint?: string
  siemApiKey?: string
  alertThresholds: {
    failedLoginsPerMinute: number
    rateLimitViolationsPerMinute: number
    suspiciousRequestsPerMinute: number
  }
  alertChannels: {
    email?: string[]
    slack?: string
    pagerDuty?: string
  }
}

/**
 * Security Monitoring Service
 */
export class SecurityMonitoringService {
  private config: MonitoringConfig
  private threatIntel: ThreatIntelligence
  private metrics: SecurityMetrics
  private eventBuffer: SecurityEvent[] = []
  private detectionRules: SecurityDetectionRule[] = []

  constructor() {
    this.config = this.loadConfig()
    this.threatIntel = this.initializeThreatIntel()
    this.metrics = this.initializeMetrics()
    this.initializeDetectionRules()
    this.startMonitoring()
  }

  /**
   * Load monitoring configuration
   */
  private loadConfig(): MonitoringConfig {
    return {
      enableRealTimeAlerts: process.env.ENABLE_SECURITY_ALERTS === 'true',
      siemEndpoint: process.env.SIEM_ENDPOINT,
      siemApiKey: process.env.SIEM_TOKEN,
      alertThresholds: {
        failedLoginsPerMinute: 5,
        rateLimitViolationsPerMinute: 10,
        suspiciousRequestsPerMinute: 20
      },
      alertChannels: {
        email: process.env.SECURITY_ALERT_EMAILS?.split(','),
        slack: process.env.SLACK_WEBHOOK_URL,
        pagerDuty: process.env.PAGERDUTY_KEY
      }
    }
  }

  /**
   * Initialize threat intelligence
   */
  private initializeThreatIntel(): ThreatIntelligence {
    return {
      ipReputation: new Map(),
      knownBadActors: new Set([
        // Add known malicious IPs here
        // In production, this would be updated from threat feeds
      ]),
      suspiciousPatterns: [
        /(<script|javascript:|onerror=|onclick=)/i, // XSS patterns
        /(union.*select|select.*from|drop.*table)/i, // SQL injection
        /(\.\.\/|\.\.\\|%2e%2e)/i, // Path traversal
        /(eval\(|exec\(|system\(|passthru\()/i, // Code execution
      ],
      blockedUserAgents: [
        /sqlmap/i, // SQL injection tool
        /nikto/i, // Web scanner
        /masscan/i, // Port scanner
        /nmap/i, // Network scanner
      ]
    }
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): SecurityMetrics {
    return {
      failedLogins: 0,
      blockedRequests: 0,
      suspiciousActivities: 0,
      criticalEvents: 0,
      meanTimeToDetect: 0,
      meanTimeToRespond: 0
    }
  }

  /**
   * Initialize detection rules
   */
  private initializeDetectionRules(): void {
    this.detectionRules = [
      {
        name: 'Brute Force Detection',
        evaluate: async (events) => {
          const recentFailedLogins = events.filter(e =>
            e.type === 'authentication.failed' &&
            e.timestamp > new Date(Date.now() - 60000) // Last minute
          )

          const loginsByIP = new Map<string, number>()
          for (const event of recentFailedLogins) {
            if (event.ipAddress) {
              loginsByIP.set(
                event.ipAddress,
                (loginsByIP.get(event.ipAddress) || 0) + 1
              )
            }
          }

          for (const [ip, count] of loginsByIP) {
            if (count >= this.config.alertThresholds.failedLoginsPerMinute) {
              return {
                detected: true,
                type: 'authentication.brute_force' as SecurityEventType,
                severity: 'high' as SeverityLevel,
                details: { ip, attempts: count }
              }
            }
          }

          return { detected: false }
        }
      },
      {
        name: 'Data Exfiltration Detection',
        evaluate: async (events) => {
          // Look for unusual data access patterns
          const dataAccess = events.filter(e =>
            e.type === 'data.unauthorized_access' &&
            e.timestamp > new Date(Date.now() - 300000) // Last 5 minutes
          )

          const accessByUser = new Map<string, number>()
          for (const event of dataAccess) {
            if (event.userId) {
              accessByUser.set(
                event.userId,
                (accessByUser.get(event.userId) || 0) + 1
              )
            }
          }

          for (const [userId, count] of accessByUser) {
            if (count > 100) { // Suspicious amount of data access
              return {
                detected: true,
                type: 'data.exfiltration_attempt' as SecurityEventType,
                severity: 'critical' as SeverityLevel,
                details: { userId, accessCount: count }
              }
            }
          }

          return { detected: false }
        }
      },
      {
        name: 'Anomaly Detection',
        evaluate: async (events) => {
          // Detect anomalous patterns using simple statistics
          // In production, use ML models for better detection
          const recentEvents = events.filter(e =>
            e.timestamp > new Date(Date.now() - 600000) // Last 10 minutes
          )

          const eventTypes = new Map<string, number>()
          for (const event of recentEvents) {
            eventTypes.set(event.type, (eventTypes.get(event.type) || 0) + 1)
          }

          // Check for unusual spikes
          for (const [type, count] of eventTypes) {
            if (count > 50) { // Threshold for anomaly
              return {
                detected: true,
                type: 'api.suspicious_pattern' as SecurityEventType,
                severity: 'medium' as SeverityLevel,
                details: { eventType: type, count }
              }
            }
          }

          return { detected: false }
        }
      }
    ]
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    // Run detection rules periodically
    setInterval(() => {
      this.runDetectionRules()
    }, 10000) // Every 10 seconds

    // Send metrics to SIEM periodically
    setInterval(() => {
      this.sendToSIEM()
    }, 60000) // Every minute

    logger.info('Security monitoring started')
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: SecurityEvent = {
      id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...event
    }

    // Add to buffer for analysis
    this.eventBuffer.push(fullEvent)
    if (this.eventBuffer.length > 1000) {
      this.eventBuffer.shift() // Remove oldest
    }

    // Update metrics
    this.updateMetrics(fullEvent)

    // Check if immediate action needed
    if (fullEvent.severity === 'critical') {
      await this.handleCriticalEvent(fullEvent)
    }

    // Log to audit trail
    await tamperEvidentAuditLogger.logEvent(
      null,
      'security.event',
      {
        resourceType: 'security',
        resourceId: fullEvent.id,
        success: false,
        errorMessage: `Security event: ${fullEvent.type}`,
        metadata: fullEvent
      }
    )

    // Send to SIEM if configured
    if (this.config.siemEndpoint) {
      await this.sendEventToSIEM(fullEvent)
    }
  }

  /**
   * Run detection rules
   */
  private async runDetectionRules(): Promise<void> {
    for (const rule of this.detectionRules) {
      try {
        const result = await rule.evaluate(this.eventBuffer)

        if (result.detected) {
          await this.logSecurityEvent({
            type: result.type,
            severity: result.severity,
            details: {
              ...result.details,
              detectedBy: rule.name
            },
            indicators: []
          })
        }
      } catch (error) {
        logger.error('Detection rule failed', error, { rule: rule.name })
      }
    }
  }

  /**
   * Handle critical security events
   */
  private async handleCriticalEvent(event: SecurityEvent): Promise<void> {
    logger.error('CRITICAL SECURITY EVENT', event)

    // Take immediate mitigation action
    const mitigation = await this.mitigateThrea(event)
    event.mitigationTaken = mitigation

    // Send alerts
    await this.sendAlerts(event)

    // Update threat intelligence
    if (event.ipAddress) {
      this.threatIntel.knownBadActors.add(event.ipAddress)
    }
  }

  /**
   * Mitigate detected threat
   */
  private async mitigateThrea(event: SecurityEvent): Promise<string> {
    switch (event.type) {
      case 'authentication.brute_force':
        // Block IP address
        if (event.ipAddress) {
          await this.blockIP(event.ipAddress)
          return `Blocked IP: ${event.ipAddress}`
        }
        break

      case 'data.exfiltration_attempt':
        // Suspend user account
        if (event.userId) {
          await this.suspendUser(event.userId)
          return `Suspended user: ${event.userId}`
        }
        break

      case 'audit.tampering_detected':
        // Lock down system
        await this.initiateEmergencyLockdown()
        return 'Emergency lockdown initiated'

      default:
        return 'No automatic mitigation available'
    }

    return 'No mitigation taken'
  }

  /**
   * Block an IP address
   */
  private async blockIP(ipAddress: string): Promise<void> {
    // In production, update firewall rules or WAF
    this.threatIntel.knownBadActors.add(ipAddress)
    logger.warn('IP blocked', { ipAddress })
  }

  /**
   * Suspend a user account
   */
  private async suspendUser(userId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false }
      })
      logger.warn('User suspended', { userId })
    } catch (error) {
      logger.error('Failed to suspend user', error, { userId })
    }
  }

  /**
   * Initiate emergency lockdown
   */
  private async initiateEmergencyLockdown(): Promise<void> {
    logger.fatal('EMERGENCY LOCKDOWN INITIATED')
    // In production: Disable all access, notify security team, preserve evidence
  }

  /**
   * Send alerts for security events
   */
  private async sendAlerts(event: SecurityEvent): Promise<void> {
    const promises: Promise<void>[] = []

    // Email alerts
    if (this.config.alertChannels.email) {
      promises.push(this.sendEmailAlert(event))
    }

    // Slack alerts
    if (this.config.alertChannels.slack) {
      promises.push(this.sendSlackAlert(event))
    }

    // PagerDuty for critical events
    if (this.config.alertChannels.pagerDuty && event.severity === 'critical') {
      promises.push(this.sendPagerDutyAlert(event))
    }

    await Promise.all(promises)
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(event: SecurityEvent): Promise<void> {
    // In production, integrate with email service
    logger.info('Email alert would be sent', { event })
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(event: SecurityEvent): Promise<void> {
    if (!this.config.alertChannels.slack) return

    try {
      const response = await fetch(this.config.alertChannels.slack, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Security Alert: ${event.type}`,
          attachments: [{
            color: event.severity === 'critical' ? 'danger' : 'warning',
            fields: [
              { title: 'Severity', value: event.severity, short: true },
              { title: 'Time', value: event.timestamp.toISOString(), short: true },
              { title: 'Details', value: JSON.stringify(event.details, null, 2) }
            ]
          }]
        })
      })

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.statusText}`)
      }
    } catch (error) {
      logger.error('Failed to send Slack alert', error)
    }
  }

  /**
   * Send PagerDuty alert
   */
  private async sendPagerDutyAlert(event: SecurityEvent): Promise<void> {
    // In production, integrate with PagerDuty API
    logger.info('PagerDuty alert would be sent', { event })
  }

  /**
   * Send events to SIEM
   */
  private async sendEventToSIEM(event: SecurityEvent): Promise<void> {
    if (!this.config.siemEndpoint || !this.config.siemApiKey) return

    try {
      const response = await fetch(this.config.siemEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.siemApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...event,
          source: 'antevus',
          environment: process.env.NODE_ENV
        })
      })

      if (!response.ok) {
        throw new Error(`SIEM API error: ${response.statusText}`)
      }
    } catch (error) {
      logger.error('Failed to send event to SIEM', error)
    }
  }

  /**
   * Send metrics to SIEM
   */
  private async sendToSIEM(): Promise<void> {
    if (!this.config.siemEndpoint) return

    await this.sendEventToSIEM({
      id: `metrics_${Date.now()}`,
      timestamp: new Date(),
      type: 'api.suspicious_pattern',
      severity: 'low',
      details: { ...this.metrics } as Record<string, unknown>,
      indicators: []
    })
  }

  /**
   * Update metrics
   */
  private updateMetrics(event: SecurityEvent): void {
    switch (event.type) {
      case 'authentication.failed':
        this.metrics.failedLogins++
        break
      case 'api.rate_limit_exceeded':
        this.metrics.blockedRequests++
        break
      default:
        this.metrics.suspiciousActivities++
    }

    if (event.severity === 'critical') {
      this.metrics.criticalEvents++
    }
  }

  /**
   * Get current security posture
   */
  getSecurityPosture(): {
    threatLevel: 'low' | 'medium' | 'high' | 'critical'
    metrics: SecurityMetrics
    activeThreats: number
    recommendations: string[]
  } {
    const activeThreats = this.threatIntel.knownBadActors.size
    const recentCriticalEvents = this.eventBuffer.filter(e =>
      e.severity === 'critical' &&
      e.timestamp > new Date(Date.now() - 3600000) // Last hour
    ).length

    let threatLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    if (recentCriticalEvents > 0) threatLevel = 'critical'
    else if (activeThreats > 10) threatLevel = 'high'
    else if (this.metrics.suspiciousActivities > 100) threatLevel = 'medium'

    const recommendations: string[] = []
    if (this.metrics.failedLogins > 100) {
      recommendations.push('Consider implementing stronger authentication')
    }
    if (activeThreats > 0) {
      recommendations.push('Review and update firewall rules')
    }

    return {
      threatLevel,
      metrics: this.metrics,
      activeThreats,
      recommendations
    }
  }
}

/**
 * Security detection rule interface
 */
interface SecurityDetectionRule {
  name: string
  evaluate: (events: SecurityEvent[]) => Promise<{
    detected: boolean
    type?: SecurityEventType
    severity?: SeverityLevel
    details?: Record<string, unknown>
  }>
}

// Export singleton instance
export const securityMonitoring = new SecurityMonitoringService()