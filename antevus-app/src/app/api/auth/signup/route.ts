import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'
import { auditLogger, AuditEventType } from '@/lib/security/audit-logger'
import { withRateLimit } from '@/lib/api/rate-limit-helper'

// SOC 2 & HIPAA compliant password requirements
const signupSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .transform(val => val.trim()),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
})

// Email configuration for SendGrid (ready but not active)
interface EmailConfig {
  provider: 'sendgrid'
  apiKey?: string
  fromEmail: string
  fromName: string
  templates: {
    welcome: string
    verification: string
    passwordReset: string
  }
}

const emailConfig: EmailConfig = {
  provider: 'sendgrid',
  apiKey: process.env.SENDGRID_API_KEY, // Will be configured later
  fromEmail: process.env.EMAIL_FROM || 'noreply@antevus.com',
  fromName: 'Antevus',
  templates: {
    welcome: 'd-welcome-template-id',
    verification: 'd-verification-template-id',
    passwordReset: 'd-password-reset-template-id'
  }
}

// Temporary storage (will be replaced with database)
interface PendingSignup {
  id: string
  email: string
  passwordHash: string
  verificationToken: string
  verificationTokenExpiry: Date
  createdAt: string
  emailVerified: boolean
  ipAddress: string
  userAgent: string
}

const pendingSignups = new Map<string, PendingSignup>()

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (SOC 2 requirement)
    const rateLimited = await withRateLimit(request, {
      key: 'api:auth:signup',
      limit: 5, // 5 signup attempts per minute per IP
      window: 60000,
      blockDuration: 5 * 60 * 1000 // 5 minute block after limit exceeded
    })

    if (rateLimited) {
      // Log rate limit violation for security monitoring
      auditLogger.logSecurityEvent('rateLimit', {
        ip: request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown',
        timestamp: new Date().toISOString(),
        userAgent: request.headers.get('user-agent') || 'unknown',
        endpoint: '/api/auth/signup'
      })
      return rateLimited
    }

    // Parse and validate request
    const body = await request.json()
    const validation = signupSchema.safeParse(body)

    if (!validation.success) {
      logger.warn('Invalid signup data', {
        errors: validation.error.issues,
        email: body.email?.split('@')[0] + '@***' // Redact domain
      })

      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.issues.map((err) => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      )
    }

    const { email, password } = validation.data

    // Check if email already exists (simulated - replace with DB check)
    if (pendingSignups.has(email)) {
      // Prevent timing attacks by always hashing even for existing emails
      await bcrypt.hash(password, 12)

      // Generic error to prevent email enumeration
      return NextResponse.json(
        { error: 'Unable to create account' },
        { status: 400 }
      )
    }

    // Generate secure verification token
    const verificationToken = uuidv4()
    const hashedToken = await bcrypt.hash(verificationToken, 10)

    // Hash password with bcrypt (HIPAA requirement)
    const passwordHash = await bcrypt.hash(password, 12)

    // Prepare user data (not saved yet)
    const userData = {
      id: uuidv4(),
      email,
      passwordHash,
      verificationToken: hashedToken,
      verificationTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      createdAt: new Date().toISOString(),
      emailVerified: false,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    }

    // Store temporarily (in production, this would be a database transaction)
    pendingSignups.set(email, userData)

    // Log signup attempt (HIPAA audit requirement)
    auditLogger.log({
      eventType: AuditEventType.AUTH_LOGIN_ATTEMPT,
      userId: userData.id,
      metadata: {
        email: email.split('@')[0] + '@***', // Redact domain for privacy
        timestamp: userData.createdAt,
        ipAddress: userData.ipAddress
      },
      action: 'New signup initiated'
    })

    // Prepare SendGrid email data (not sent yet)
    const emailData = {
      to: email,
      from: {
        email: emailConfig.fromEmail,
        name: emailConfig.fromName
      },
      templateId: emailConfig.templates.verification,
      dynamicTemplateData: {
        verificationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/verify?token=${verificationToken}`,
        userEmail: email,
        expiresIn: '24 hours'
      }
    }

    logger.info('Signup data prepared', {
      userId: userData.id,
      email: email.split('@')[0] + '@***',
      emailReady: !!emailConfig.apiKey,
      sendGridConfigured: false // Will be true when SendGrid is set up
    })

    // For now, return success with verification instructions
    return NextResponse.json(
      {
        message: 'Account created successfully',
        requiresVerification: true,
        // In development, include the token (remove in production)
        ...(process.env.NODE_ENV === 'development' && {
          verificationToken,
          emailData
        })
      },
      { status: 201 }
    )

  } catch (error) {
    logger.error('Signup error', error)

    // Log error for security monitoring
    auditLogger.logSecurityEvent('suspicious', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      endpoint: '/api/auth/signup'
    })

    // Generic error to prevent information leakage
    return NextResponse.json(
      { error: 'Unable to process signup request' },
      { status: 500 }
    )
  }
}

// OPTIONS for CORS preflight (required for production)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  })
}