import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'
import { auditLogger } from '@/lib/security/audit-logger'
import { withRateLimit } from '@/lib/api/rate-limit-helper'
import { prisma } from '@/lib/db/prisma'

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

// Cleanup expired verification tokens from database (runs on each request)
// In production, this should be a scheduled job
async function cleanupExpiredTokens() {
  try {
    const deleted = await prisma.verificationToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    })
    if (deleted.count > 0) {
      logger.info('Cleaned up expired verification tokens', { count: deleted.count })
    }
  } catch (error) {
    logger.error('Failed to cleanup expired tokens', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    // CSRF Protection - Verify origin header
    const origin = request.headers.get('origin')
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL,
      'http://localhost:3000',
      'http://localhost:3003', // Add port 3003 for dev server
      'https://app.antevus.com'
    ].filter(Boolean)

    if (!origin || !allowedOrigins.includes(origin)) {
      logger.warn('CSRF protection triggered', {
        origin,
        expectedOrigins: allowedOrigins
      })
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { status: 403 }
      )
    }

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

    // Demo mode for admin@antevus.com - skip real signup
    if (email === 'admin@antevus.com') {
      logger.info('Demo signup initiated', { email })

      // Return success response for demo mode
      return NextResponse.json(
        {
          message: 'Demo account ready! Proceed to verification.',
          requiresVerification: true,
          userId: 'demo-user-id',
          isDemo: true
        },
        { status: 201 }
      )
    }

    // Check if email already exists in database
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      // Prevent timing attacks by always hashing even for existing emails
      await bcrypt.hash(password, 12)

      // Generic error to prevent email enumeration
      return NextResponse.json(
        { error: 'Unable to create account' },
        { status: 400 }
      )
    }

    // Hash password with bcrypt (HIPAA requirement)
    const passwordHash = await bcrypt.hash(password, 12)

    // Cleanup expired tokens periodically (1% chance on each signup)
    if (Math.random() < 0.01) {
      cleanupExpiredTokens() // Fire and forget
    }

    // Create user in database (transaction for data integrity)
    let verificationToken: string = ''
    const user = await prisma.$transaction(async (tx) => {
      // Create the user
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: email.split('@')[0], // Temporary name from email
          role: 'viewer', // Default role
        }
      })

      // Generate verification token and store in database
      verificationToken = uuidv4()
      const tokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex')

      // Store verification token in database
      await tx.verificationToken.create({
        data: {
          userId: newUser.id,
          token: verificationToken,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
      })

      // Log the signup in audit table
      await tx.auditEvent.create({
        data: {
          userId: newUser.id,
          eventType: 'AUTH_LOGIN_SUCCESS', // Use existing enum value for signup success
          ipAddress: request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          metadata: {
            action: 'signup',
            email: email.split('@')[0] + '@***', // Redact domain for privacy
            resourceType: 'USER',
            resourceId: newUser.id
          }
        }
      })

      return newUser
    })

    // Audit logging already done in database transaction above
    // No need for duplicate logging here

    // TODO: Send verification email when SendGrid is configured
    // Will use the verificationToken stored in pendingVerifications

    logger.info('User account created', {
      userId: user.id,
      email: email.split('@')[0] + '@***',
      emailReady: !!emailConfig.apiKey,
      sendGridConfigured: false // Will be true when SendGrid is set up
    })

    // For now, return success with verification instructions
    return NextResponse.json(
      {
        message: 'Account created successfully. Please check your email for verification instructions.',
        requiresVerification: true,
        userId: user.id // Safe to return the user ID
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
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000',
    'http://localhost:3003', // Add port 3003 for dev server
    'https://app.antevus.com'
  ].filter(Boolean)

  // Only allow specific origins
  const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin || '',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  })
}