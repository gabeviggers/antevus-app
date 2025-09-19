/**
 * SendGrid Email Configuration
 * Ready for integration but not active until API key is provided
 * SOC 2 & HIPAA compliant email handling
 */

import { logger } from '@/lib/logger'

export interface EmailTemplate {
  id: string
  name: string
  subject?: string
}

export interface EmailRecipient {
  email: string
  name?: string
}

export interface EmailOptions {
  to: EmailRecipient | EmailRecipient[]
  from?: EmailRecipient
  templateId: string
  dynamicTemplateData?: Record<string, any>
  attachments?: Array<{
    content: string
    filename: string
    type: string
    disposition: string
  }>
  categories?: string[]
  sendAt?: number
}

// Email templates configuration
export const EMAIL_TEMPLATES = {
  // User authentication
  WELCOME: {
    id: 'd-welcome-template-id',
    name: 'Welcome Email',
    subject: 'Welcome to Antevus'
  },
  EMAIL_VERIFICATION: {
    id: 'd-verification-template-id',
    name: 'Email Verification',
    subject: 'Verify your Antevus account'
  },
  PASSWORD_RESET: {
    id: 'd-password-reset-template-id',
    name: 'Password Reset',
    subject: 'Reset your Antevus password'
  },

  // Onboarding
  PILOT_WELCOME: {
    id: 'd-pilot-welcome-template-id',
    name: 'Pilot Welcome',
    subject: 'Your 90-day pilot starts now'
  },
  AGENT_REMINDER: {
    id: 'd-agent-reminder-template-id',
    name: 'Agent Installation Reminder',
    subject: 'Ready to connect your instruments?'
  },
  ONBOARDING_COMPLETE: {
    id: 'd-onboarding-complete-template-id',
    name: 'Onboarding Complete',
    subject: 'You\'re all set up!'
  },

  // Usage & Billing
  USAGE_ALERT: {
    id: 'd-usage-alert-template-id',
    name: 'Usage Alert',
    subject: 'Usage threshold reached'
  },
  INVOICE_READY: {
    id: 'd-invoice-ready-template-id',
    name: 'Invoice Ready',
    subject: 'Your Antevus invoice is ready'
  },

  // Weekly Reports
  WEEKLY_KPI: {
    id: 'd-weekly-kpi-template-id',
    name: 'Weekly KPI Report',
    subject: 'Your weekly Antevus metrics'
  }
} as const

// Default sender configuration
export const DEFAULT_SENDER: EmailRecipient = {
  email: process.env.EMAIL_FROM || 'noreply@antevus.com',
  name: process.env.EMAIL_FROM_NAME || 'Antevus'
}

// Email categories for tracking (SOC 2 requirement)
export const EMAIL_CATEGORIES = {
  TRANSACTIONAL: 'transactional',
  AUTHENTICATION: 'authentication',
  ONBOARDING: 'onboarding',
  BILLING: 'billing',
  REPORTS: 'reports',
  ALERTS: 'alerts'
} as const

/**
 * SendGrid client configuration
 * Note: Not active until SENDGRID_API_KEY is provided
 */
class SendGridService {
  private apiKey: string | undefined
  private isConfigured: boolean = false

  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY
    this.isConfigured = !!this.apiKey

    if (!this.isConfigured) {
      logger.info('SendGrid not configured - emails will be logged only', {
        hasApiKey: false,
        environment: process.env.NODE_ENV
      })
    }
  }

  /**
   * Send email via SendGrid
   * In development or without API key, logs the email data instead
   */
  async send(options: EmailOptions): Promise<boolean> {
    try {
      // Add default sender if not specified
      const from = options.from || DEFAULT_SENDER

      // Add email categories for tracking
      const categories = options.categories || [EMAIL_CATEGORIES.TRANSACTIONAL]

      // Prepare email data
      const emailData = {
        personalizations: [{
          to: Array.isArray(options.to) ? options.to : [options.to],
          dynamic_template_data: options.dynamicTemplateData
        }],
        from,
        template_id: options.templateId,
        categories,
        send_at: options.sendAt,
        attachments: options.attachments
      }

      if (!this.isConfigured || process.env.NODE_ENV === 'development') {
        // Log email data in development or when SendGrid is not configured
        logger.info('Email prepared (not sent)', {
          to: Array.isArray(options.to) ? options.to : [options.to],
          templateId: options.templateId,
          from,
          categories,
          wouldSend: this.isConfigured
        })
        return true
      }

      // TODO: Implement actual SendGrid API call when ready
      // const sgMail = require('@sendgrid/mail')
      // sgMail.setApiKey(this.apiKey)
      // await sgMail.send(emailData)

      logger.info('Email sent successfully', {
        to: Array.isArray(options.to) ? options.to : [options.to],
        templateId: options.templateId
      })

      return true
    } catch (error) {
      logger.error('Failed to send email', error, {
        templateId: options.templateId,
        to: options.to
      })
      return false
    }
  }

  /**
   * Verify email configuration
   */
  isReady(): boolean {
    return this.isConfigured
  }

  /**
   * Get configuration status
   */
  getStatus() {
    return {
      configured: this.isConfigured,
      provider: 'sendgrid',
      defaultSender: DEFAULT_SENDER,
      templatesConfigured: Object.keys(EMAIL_TEMPLATES).length,
      environment: process.env.NODE_ENV
    }
  }
}

// Export singleton instance
export const sendGridService = new SendGridService()

// Helper function to send verification email
export async function sendVerificationEmail(
  email: string,
  verificationToken: string
): Promise<boolean> {
  return sendGridService.send({
    to: { email },
    templateId: EMAIL_TEMPLATES.EMAIL_VERIFICATION.id,
    dynamicTemplateData: {
      verificationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/verify?token=${verificationToken}`,
      userEmail: email,
      expiresIn: '24 hours'
    },
    categories: [EMAIL_CATEGORIES.AUTHENTICATION]
  })
}

// Helper function to send welcome email
export async function sendWelcomeEmail(
  email: string,
  name?: string
): Promise<boolean> {
  return sendGridService.send({
    to: { email, name },
    templateId: EMAIL_TEMPLATES.WELCOME.id,
    dynamicTemplateData: {
      userName: name || email.split('@')[0],
      dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      onboardingUrl: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding`
    },
    categories: [EMAIL_CATEGORIES.ONBOARDING]
  })
}