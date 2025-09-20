# Complete Environment Variables Documentation

## 🚨 CRITICAL: Every Single Environment Variable for Antevus

This document contains **EVERY** environment variable used in the codebase.
Last updated: December 19, 2024

---

## 📋 Quick Setup Templates

### Production (Vercel) - COPY THIS ENTIRE BLOCK
```env
# ============================================
# REQUIRED FOR PRODUCTION
# ============================================

# Core Configuration
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Database (Required)
DATABASE_URL=postgresql://user:password@host:5432/dbname?schema=public

# Security Keys (Required - Generate new ones!)
ENCRYPTION_KEY=<generate-with: openssl rand -hex 32>
CHAT_ENCRYPTION_KEY=<generate-with: openssl rand -hex 32>
SESSION_SECRET=<generate-with: openssl rand -base64 32>
CSRF_SECRET=<generate-with: openssl rand -base64 32>
JWT_SECRET=<generate-with: openssl rand -base64 32>

# JWT Configuration (Required for auth)
JWT_ISSUER=https://your-app.vercel.app
JWT_AUDIENCE=https://your-app.vercel.app
JWT_EXPIRATION=15m
# Choose one:
JWKS_URI=https://your-auth-provider.com/.well-known/jwks.json
# OR
JWT_PUBLIC_KEY=<your-rsa-public-key>

# API Keys Encryption
API_KEY_ENCRYPTION_KEY=<generate-with: openssl rand -hex 32>
CREDENTIAL_ENCRYPTION_KEY=<generate-with: openssl rand -hex 32>

# Audit & Compliance (Required for HIPAA/SOC2)
ENABLE_AUDIT_LOGGING=true
AUDIT_LOG_ENDPOINT=https://your-siem.com/api/logs
AUDIT_LOG_HMAC_SECRET=<generate-with: openssl rand -base64 32>
AUDIT_SIGNING_KEY=<generate-with: openssl rand -hex 32>
DATA_SIGNING_KEY=<generate-with: openssl rand -hex 32>

# Email Service (Required for notifications)
SENDGRID_API_KEY=SG.xxxxx
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Antevus

# Security Features (All should be true in production)
ENABLE_CSRF_PROTECTION=true
ENABLE_RATE_LIMIT=true
ENABLE_DATA_ENCRYPTION=true
ENABLE_HIPAA_COMPLIANCE=true
ENABLE_GDPR_COMPLIANCE=true
ENABLE_SECURITY_ALERTS=true

# Demo Mode (MUST be false in production)
DEMO_MODE=false
NEXT_PUBLIC_DEMO=false
ALLOW_MOCK_USERS=false
USE_MOCK_DATA=false

# Feature Flags
ENABLE_ONBOARDING=true
ENABLE_INTEGRATIONS=true
ENABLE_API_PLAYGROUND=true
ENABLE_WEBHOOKS=true
ENABLE_AUTOMATIONS=true
ENABLE_ASSISTANT=true
ENABLE_AI_ASSISTANT=true

# Monitoring (Optional but recommended)
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxx
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
LOG_LEVEL=info

# Slack Notifications (Optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
SECURITY_ALERT_EMAILS=security@yourdomain.com
PAGERDUTY_KEY=xxx

# SIEM Integration (Optional)
SIEM_ENDPOINT=https://your-siem.com/api
SIEM_TOKEN=xxx

# Rate Limiting
FAIL_OPEN_RATE_LIMIT=false
SKIP_RATE_LIMIT=false

# Debug (MUST be false in production)
DEBUG_MODE=false
DISABLE_AUDIT_CONSOLE=true
```

### Local Development - COPY THIS ENTIRE BLOCK to .env.local
```env
# ============================================
# LOCAL DEVELOPMENT CONFIGURATION
# ============================================

# Core Configuration
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database (Local PostgreSQL or SQLite)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/antevus_dev
# OR for SQLite:
# DATABASE_URL=file:./dev.db

# Security Keys (Weak keys OK for local dev)
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
CHAT_ENCRYPTION_KEY=dev-chat-key-32-chars-xxxxxxxxxxxxxxxxx
SESSION_SECRET=dev-session-secret
CSRF_SECRET=dev-csrf-secret
JWT_SECRET=dev-jwt-secret

# JWT Configuration (Use demo values)
JWT_ISSUER=http://localhost:3000
JWT_AUDIENCE=http://localhost:3000
JWT_EXPIRATION=7d
# For local, you can skip JWKS_URI and JWT_PUBLIC_KEY

# API Keys Encryption (Dev keys)
API_KEY_ENCRYPTION_KEY=dev-api-key-encryption
CREDENTIAL_ENCRYPTION_KEY=dev-credential-encryption

# Audit & Compliance (Can be disabled for dev)
ENABLE_AUDIT_LOGGING=false
DISABLE_AUDIT_CONSOLE=true
AUDIT_LOG_HMAC_SECRET=dev-audit-secret
AUDIT_SIGNING_KEY=dev-audit-signing
DATA_SIGNING_KEY=dev-data-signing

# Email Service (Optional for dev)
SENDGRID_API_KEY=
EMAIL_FROM=dev@localhost
EMAIL_FROM_NAME=Antevus Dev

# Security Features (Can be relaxed for dev)
ENABLE_CSRF_PROTECTION=false
ENABLE_RATE_LIMIT=false
ENABLE_DATA_ENCRYPTION=false
ENABLE_HIPAA_COMPLIANCE=false
ENABLE_GDPR_COMPLIANCE=false
ENABLE_SECURITY_ALERTS=false

# Demo Mode (Enable for easier development)
DEMO_MODE=true
NEXT_PUBLIC_DEMO=true
NEXT_PUBLIC_DEMO_MODE=true
DEMO_ALLOWED_EMAIL=admin@antevus.com
NEXT_PUBLIC_DEMO_KEY=demo-key-for-testing
ALLOW_MOCK_USERS=true
USE_MOCK_DATA=true

# Feature Flags (Enable all for testing)
ENABLE_ONBOARDING=true
ENABLE_INTEGRATIONS=true
ENABLE_API_PLAYGROUND=true
ENABLE_WEBHOOKS=true
ENABLE_AUTOMATIONS=true
ENABLE_ASSISTANT=true
ENABLE_AI_ASSISTANT=true
ENABLE_ALPHA_FEATURES=true
ENABLE_BETA_FEATURES=true

# Monitoring (Optional for dev)
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
LOG_LEVEL=debug

# Notifications (Usually disabled for dev)
SLACK_WEBHOOK_URL=
SECURITY_ALERT_EMAILS=
PAGERDUTY_KEY=

# SIEM Integration (Not needed for dev)
SIEM_ENDPOINT=
SIEM_TOKEN=

# Rate Limiting (Disabled for dev)
FAIL_OPEN_RATE_LIMIT=true
SKIP_RATE_LIMIT=true

# Debug (Enable for development)
DEBUG_MODE=true

# Auth (For local testing)
AUTH_PASSWORD=demo-password

# Double Submit Cookie (For CSRF in dev)
ENABLE_DOUBLE_SUBMIT=false

# Vercel Environment (Auto-set by Vercel)
VERCEL_ENV=development
```

---

## 📝 Complete Variable Reference (Alphabetical)

### A

#### `ALLOW_MOCK_USERS`
- **Required**: No
- **Production**: `false`
- **Development**: `true`
- **Description**: Allows mock user authentication for testing
- **Used in**: `src/lib/auth/demo-auth.ts`

#### `API_KEY_ENCRYPTION_KEY`
- **Required**: Yes (if using API keys)
- **Production**: 32-byte hex string
- **Development**: Any string
- **Description**: Encryption key for API keys storage
- **Generate**: `openssl rand -hex 32`
- **Used in**: `src/lib/api/key-manager.ts`

#### `AUDIT_LOG_ENDPOINT`
- **Required**: Yes (for compliance)
- **Production**: SIEM endpoint URL
- **Development**: Can be empty
- **Description**: Where to send audit logs
- **Used in**: `src/lib/audit/logger.ts`

#### `AUDIT_LOG_HMAC_SECRET`
- **Required**: Yes (for compliance)
- **Production**: Random secret
- **Development**: Any string
- **Description**: HMAC secret for audit log integrity
- **Generate**: `openssl rand -base64 32`
- **Used in**: `src/lib/audit/logger.ts`

#### `AUDIT_SIGNING_KEY`
- **Required**: Yes (for compliance)
- **Production**: 32-byte hex string
- **Development**: Any string
- **Description**: Key for signing audit logs
- **Generate**: `openssl rand -hex 32`
- **Used in**: `src/lib/security/signing.ts`

#### `AUTH_PASSWORD`
- **Required**: No
- **Production**: Not used
- **Development**: Demo password
- **Description**: Basic auth password for dev
- **Used in**: `src/app/api/auth/login/route.ts`

### C

#### `CHAT_ENCRYPTION_KEY`
- **Required**: Yes
- **Production**: 32-byte hex string
- **Development**: Any 32+ char string
- **Description**: Encryption for chat thread storage
- **Generate**: `openssl rand -hex 32`
- **Used in**: `src/app/api/chat/threads/route.ts`

#### `CREDENTIAL_ENCRYPTION_KEY`
- **Required**: Yes (if storing credentials)
- **Production**: 32-byte hex string
- **Development**: Any string
- **Description**: Encryption for integration credentials
- **Generate**: `openssl rand -hex 32`
- **Used in**: `src/app/api/integrations/[id]/credentials/route.ts`

#### `CSRF_SECRET`
- **Required**: Yes
- **Production**: Random secret
- **Development**: Any string
- **Description**: Secret for CSRF token generation
- **Generate**: `openssl rand -base64 32`
- **Used in**: `src/lib/security/csrf.ts`

### D

#### `DATA_SIGNING_KEY`
- **Required**: Yes (for data integrity)
- **Production**: 32-byte hex string
- **Development**: Any string
- **Description**: Key for signing sensitive data
- **Generate**: `openssl rand -hex 32`
- **Used in**: `src/lib/security/signing.ts`

#### `DATABASE_URL`
- **Required**: Yes
- **Production**: PostgreSQL connection string
- **Development**: PostgreSQL or SQLite
- **Description**: Primary database connection
- **Example**: `postgresql://user:pass@host:5432/db`
- **Used in**: `prisma/schema.prisma`

#### `DEBUG_MODE`
- **Required**: No
- **Production**: `false` or unset
- **Development**: `true`
- **Description**: Enables debug logging
- **Used in**: `src/lib/logger/index.ts`

#### `DEMO_ALLOWED_EMAIL`
- **Required**: No
- **Production**: Not set
- **Development**: `admin@antevus.com`
- **Description**: Email allowed for demo login
- **Used in**: `src/app/api/auth/demo/route.ts`

#### `DEMO_MODE`
- **Required**: Yes
- **Production**: `false`
- **Development**: `true`
- **Description**: Enables demo mode features
- **Used in**: Multiple auth files

#### `DISABLE_AUDIT_CONSOLE`
- **Required**: No
- **Production**: `true`
- **Development**: `true`
- **Description**: Disables audit logs to console
- **Used in**: `src/lib/audit/logger.ts`

### E

#### `EMAIL_FROM`
- **Required**: Yes (for emails)
- **Production**: Your email address
- **Development**: `dev@localhost`
- **Description**: From address for emails
- **Used in**: `src/lib/notifications/email.ts`

#### `EMAIL_FROM_NAME`
- **Required**: No
- **Production**: Your company name
- **Development**: `Antevus Dev`
- **Description**: From name for emails
- **Used in**: `src/lib/notifications/email.ts`

#### `ENABLE_AI_ASSISTANT`
- **Required**: No
- **Production**: `true` or `false`
- **Development**: `true`
- **Description**: Enables AI assistant features
- **Used in**: `src/app/(app)/lab-assistant/page.tsx`

#### `ENABLE_ALPHA_FEATURES`
- **Required**: No
- **Production**: `false`
- **Development**: `true`
- **Description**: Enables alpha features
- **Used in**: Feature flag checks

#### `ENABLE_API_PLAYGROUND`
- **Required**: No
- **Production**: `true` or `false`
- **Development**: `true`
- **Description**: Enables API playground
- **Used in**: `src/app/(app)/api-playground/page.tsx`

#### `ENABLE_ASSISTANT`
- **Required**: No
- **Production**: `true` or `false`
- **Development**: `true`
- **Description**: Enables assistant features
- **Used in**: Navigation components

#### `ENABLE_AUDIT_LOGGING`
- **Required**: Yes (for compliance)
- **Production**: `true`
- **Development**: `false`
- **Description**: Enables audit logging
- **Used in**: `src/lib/audit/logger.ts`

#### `ENABLE_AUTOMATIONS`
- **Required**: No
- **Production**: `true` or `false`
- **Development**: `true`
- **Description**: Enables automation features
- **Used in**: Feature checks

#### `ENABLE_BETA_FEATURES`
- **Required**: No
- **Production**: `false`
- **Development**: `true`
- **Description**: Enables beta features
- **Used in**: Feature flag checks

#### `ENABLE_CSRF_PROTECTION`
- **Required**: Yes
- **Production**: `true`
- **Development**: `false` (for ease)
- **Description**: Enables CSRF protection
- **Used in**: `src/lib/security/csrf-middleware.ts`

#### `ENABLE_DATA_ENCRYPTION`
- **Required**: Yes (for compliance)
- **Production**: `true`
- **Development**: `false`
- **Description**: Enables data encryption at rest
- **Used in**: `src/lib/security/encryption-service.ts`

#### `ENABLE_DOUBLE_SUBMIT`
- **Required**: No
- **Production**: `true`
- **Development**: `false`
- **Description**: Double submit cookie for CSRF
- **Used in**: `src/lib/security/csrf.ts`

#### `ENABLE_GDPR_COMPLIANCE`
- **Required**: Yes (if in EU)
- **Production**: `true`
- **Development**: `false`
- **Description**: Enables GDPR compliance features
- **Used in**: Data retention policies

#### `ENABLE_HIPAA_COMPLIANCE`
- **Required**: Yes (if handling PHI)
- **Production**: `true`
- **Development**: `false`
- **Description**: Enables HIPAA compliance
- **Used in**: `src/lib/security/compliance.ts`

#### `ENABLE_INTEGRATIONS`
- **Required**: No
- **Production**: `true`
- **Development**: `true`
- **Description**: Enables integration features
- **Used in**: `src/app/(app)/integrations/page.tsx`

#### `ENABLE_ONBOARDING`
- **Required**: No
- **Production**: `true`
- **Development**: `true`
- **Description**: Enables onboarding flow
- **Used in**: `src/middleware.ts`

#### `ENABLE_RATE_LIMIT`
- **Required**: Yes
- **Production**: `true`
- **Development**: `false`
- **Description**: Enables rate limiting
- **Used in**: `src/lib/api/rate-limit-helper.ts`

#### `ENABLE_SECURITY_ALERTS`
- **Required**: Yes
- **Production**: `true`
- **Development**: `false`
- **Description**: Enables security alerting
- **Used in**: `src/lib/security/alerts.ts`

#### `ENABLE_WEBHOOKS`
- **Required**: No
- **Production**: `true` or `false`
- **Development**: `true`
- **Description**: Enables webhook features
- **Used in**: Integration settings

#### `ENCRYPTION_KEY`
- **Required**: Yes
- **Production**: 32-byte hex string (64 chars)
- **Development**: Any 64-char hex string
- **Description**: Master encryption key
- **Generate**: `openssl rand -hex 32`
- **Used in**: `src/lib/security/encryption-service.ts`

### F

#### `FAIL_OPEN_RATE_LIMIT`
- **Required**: No
- **Production**: `false`
- **Development**: `true`
- **Description**: Fail open if rate limit errors
- **Used in**: `src/lib/api/rate-limit-helper.ts`

### J

#### `JWKS_URI`
- **Required**: One of JWKS_URI or JWT_PUBLIC_KEY
- **Production**: JWKS endpoint URL
- **Development**: Not needed
- **Description**: JWKS endpoint for JWT verification
- **Used in**: `src/lib/security/auth-manager.ts`

#### `JWT_AUDIENCE`
- **Required**: Yes (for JWT)
- **Production**: Your app URL
- **Development**: `http://localhost:3000`
- **Description**: JWT audience claim
- **Used in**: `src/lib/security/auth-manager.ts`

#### `JWT_EXPIRATION`
- **Required**: No
- **Production**: `15m`
- **Development**: `7d`
- **Description**: JWT expiration time
- **Used in**: `src/lib/security/auth-manager.ts`

#### `JWT_ISSUER`
- **Required**: Yes (for JWT)
- **Production**: Your app URL
- **Development**: `http://localhost:3000`
- **Description**: JWT issuer claim
- **Used in**: `src/lib/security/auth-manager.ts`

#### `JWT_PUBLIC_KEY`
- **Required**: One of JWKS_URI or JWT_PUBLIC_KEY
- **Production**: RSA public key
- **Development**: Not needed
- **Description**: Public key for JWT verification
- **Used in**: `src/lib/security/auth-manager.ts`

#### `JWT_SECRET`
- **Required**: Yes
- **Production**: Random 32+ char secret
- **Development**: Any string
- **Description**: JWT signing secret
- **Generate**: `openssl rand -base64 32`
- **Used in**: `src/lib/auth/jwt.ts`

### L

#### `LOG_LEVEL`
- **Required**: No
- **Production**: `info` or `warn`
- **Development**: `debug`
- **Description**: Logging verbosity
- **Options**: `error`, `warn`, `info`, `debug`
- **Used in**: `src/lib/logger/index.ts`

### N

#### `NEXT_PHASE`
- **Required**: No (auto-set)
- **Production**: Set by Next.js
- **Development**: Set by Next.js
- **Description**: Next.js build phase
- **Used in**: Build-time checks

#### `NEXT_PUBLIC_APP_URL`
- **Required**: Yes
- **Production**: Your app URL
- **Development**: `http://localhost:3000`
- **Description**: Public app URL
- **Used in**: Client-side code

#### `NEXT_PUBLIC_DEMO`
- **Required**: No
- **Production**: `false` or unset
- **Development**: `true`
- **Description**: Public demo mode flag
- **Used in**: Client-side demo checks

#### `NEXT_PUBLIC_DEMO_KEY`
- **Required**: No
- **Production**: Not set
- **Development**: Any string
- **Description**: Demo authentication key
- **Used in**: Demo auth

#### `NEXT_PUBLIC_DEMO_MODE`
- **Required**: No
- **Production**: Not set
- **Development**: `true`
- **Description**: Client-side demo flag
- **Used in**: Client components

#### `NEXT_PUBLIC_ENCRYPTION_KEY`
- **Required**: No
- **Production**: NEVER SET THIS
- **Development**: NEVER SET THIS
- **Description**: DEPRECATED - Security risk
- **Used in**: Error checking only

#### `NEXT_PUBLIC_POSTHOG_HOST`
- **Required**: No
- **Production**: `https://app.posthog.com`
- **Development**: Optional
- **Description**: PostHog host
- **Used in**: Analytics

#### `NEXT_PUBLIC_POSTHOG_KEY`
- **Required**: No
- **Production**: Your PostHog key
- **Development**: Optional
- **Description**: PostHog project key
- **Used in**: Analytics

#### `NODE_ENV`
- **Required**: Yes
- **Production**: `production`
- **Development**: `development`
- **Description**: Node environment
- **Used in**: Throughout app

### P

#### `PAGERDUTY_KEY`
- **Required**: No
- **Production**: Your PagerDuty key
- **Development**: Not needed
- **Description**: PagerDuty integration
- **Used in**: Alert escalation

### S

#### `SECURITY_ALERT_EMAILS`
- **Required**: No
- **Production**: Security team emails
- **Development**: Not needed
- **Description**: Where to send alerts
- **Used in**: `src/lib/security/alerts.ts`

#### `SENDGRID_API_KEY`
- **Required**: Yes (for emails)
- **Production**: Your SendGrid key
- **Development**: Optional
- **Description**: SendGrid API key
- **Used in**: `src/lib/notifications/email.ts`

#### `SESSION_SECRET`
- **Required**: Yes
- **Production**: Random secret
- **Development**: Any string
- **Description**: Session encryption secret
- **Generate**: `openssl rand -base64 32`
- **Used in**: Session management

#### `SIEM_ENDPOINT`
- **Required**: No
- **Production**: SIEM API endpoint
- **Development**: Not needed
- **Description**: SIEM integration endpoint
- **Used in**: `src/lib/security/siem.ts`

#### `SIEM_TOKEN`
- **Required**: No
- **Production**: SIEM auth token
- **Development**: Not needed
- **Description**: SIEM authentication
- **Used in**: `src/lib/security/siem.ts`

#### `SKIP_RATE_LIMIT`
- **Required**: No
- **Production**: `false` or unset
- **Development**: `true`
- **Description**: Skip rate limiting
- **Used in**: `src/lib/api/rate-limit-helper.ts`

#### `SLACK_WEBHOOK_URL`
- **Required**: No
- **Production**: Slack webhook URL
- **Development**: Optional
- **Description**: Slack notifications
- **Used in**: `src/lib/notifications/slack.ts`

### U

#### `USE_MOCK_DATA`
- **Required**: No
- **Production**: `false`
- **Development**: `true`
- **Description**: Use mock data instead of real
- **Used in**: Data fetching

### V

#### `VERCEL_ENV`
- **Required**: No (auto-set)
- **Production**: Set by Vercel
- **Development**: Not set
- **Description**: Vercel environment
- **Used in**: Deployment checks

---

## 🚀 Quick Start Commands

### Generate All Security Keys at Once (macOS/Linux)
```bash
# Run this to generate all keys
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "CHAT_ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "SESSION_SECRET=$(openssl rand -base64 32)"
echo "CSRF_SECRET=$(openssl rand -base64 32)"
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "API_KEY_ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "CREDENTIAL_ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "AUDIT_LOG_HMAC_SECRET=$(openssl rand -base64 32)"
echo "AUDIT_SIGNING_KEY=$(openssl rand -hex 32)"
echo "DATA_SIGNING_KEY=$(openssl rand -hex 32)"
```

### Verify Your Production Config
```bash
# Check for required variables
node -e "
const required = [
  'NODE_ENV',
  'DATABASE_URL',
  'ENCRYPTION_KEY',
  'CHAT_ENCRYPTION_KEY',
  'SESSION_SECRET',
  'JWT_SECRET',
  'DEMO_MODE'
];
required.forEach(v => {
  if (!process.env[v]) console.log('❌ Missing:', v);
  else console.log('✅', v);
});
"
```

---

## ⚠️ Security Checklist

### NEVER in Production:
- [ ] `DEMO_MODE` must be `false`
- [ ] `NEXT_PUBLIC_DEMO` must be `false`
- [ ] `ALLOW_MOCK_USERS` must be `false`
- [ ] `USE_MOCK_DATA` must be `false`
- [ ] `DEBUG_MODE` must be `false`
- [ ] `SKIP_RATE_LIMIT` must be `false`
- [ ] `FAIL_OPEN_RATE_LIMIT` must be `false`
- [ ] No `NEXT_PUBLIC_ENCRYPTION_KEY` ever

### ALWAYS in Production:
- [ ] `NODE_ENV=production`
- [ ] `ENABLE_CSRF_PROTECTION=true`
- [ ] `ENABLE_RATE_LIMIT=true`
- [ ] `ENABLE_AUDIT_LOGGING=true`
- [ ] `ENABLE_DATA_ENCRYPTION=true`
- [ ] `ENABLE_SECURITY_ALERTS=true`
- [ ] All encryption keys are random and unique
- [ ] `DATABASE_URL` uses SSL connection

---

## 📚 Additional Notes

1. **Vercel Deployment**: Add variables in Vercel Dashboard > Settings > Environment Variables
2. **Local Development**: Copy everything to `.env.local` (git-ignored)
3. **Key Rotation**: Rotate all keys every 90 days in production
4. **Secrets Management**: Consider using AWS Secrets Manager or HashiCorp Vault
5. **Never Commit**: Never commit `.env.local` or any file with real secrets

---

## 🆘 Troubleshooting

### "ENCRYPTION_KEY is required in production"
- Set `ENCRYPTION_KEY` with a 64-character hex string
- Generate: `openssl rand -hex 32`

### "JWT verification not configured"
- Set either `JWKS_URI` or `JWT_PUBLIC_KEY`
- Also set `JWT_ISSUER` and `JWT_AUDIENCE`

### "CHAT_ENCRYPTION_KEY is required in production"
- Set `CHAT_ENCRYPTION_KEY` with a 32+ character string
- Generate: `openssl rand -hex 32`

### Build fails with environment errors
- The build phase now skips validation
- Errors will only occur at runtime
- Ensure all required vars are set in Vercel

---

## 📞 Support

If you're missing any variables or need help:
1. Check this document first
2. Search codebase for `process.env.YOUR_VARIABLE`
3. Check `.env.example` for examples
4. Contact: gabeviggers@gmail.com

---

**Last Updated**: December 19, 2024
**Total Variables**: 63
**Required for Production**: 22
**Security Critical**: 15