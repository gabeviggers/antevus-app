# Environment Setup Guide

## Table of Contents
- [Development Environment](#development-environment)
- [Production Environment](#production-environment)
- [Security & Compliance](#security--compliance)
- [Demo Account Configuration](#demo-account-configuration)
- [Troubleshooting](#troubleshooting)

---

## Development Environment

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/gabeviggers/antevus-app.git
   cd antevus-app/antevus-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

### Environment Variables (.env.local)

Create a `.env.local` file with the following configuration:

```env
# Development Environment Variables
# This file is for local development only - do not commit to git

# Database Configuration
# Using SQLite for local development (no PostgreSQL needed)
DATABASE_URL="file:./dev.db"

# Development Settings
NODE_ENV=development
SKIP_RATE_LIMIT=true              # Disable rate limiting in dev
DISABLE_AUDIT_CONSOLE=true        # Reduce console noise

# Security (Development Only)
JWT_SECRET=development-secret-key-do-not-use-in-production

# Optional: OpenAI Integration (for Lab Assistant)
OPENAI_API_KEY=sk-...             # Your OpenAI API key
```

### Key Development Features

| Feature | Purpose | Configuration |
|---------|---------|---------------|
| **SQLite Database** | Local database without PostgreSQL | `DATABASE_URL="file:./dev.db"` |
| **No Rate Limiting** | Faster development iteration | `SKIP_RATE_LIMIT=true` |
| **Quiet Logging** | Cleaner console output | `DISABLE_AUDIT_CONSOLE=true` |
| **Hot Reload** | Instant code updates | Enabled by default |

---

## Production Environment

### Prerequisites

- Node.js 18+ or 20+ LTS
- PostgreSQL 14+ or 15+
- Redis 6+ (optional, for caching)
- SSL/TLS certificates
- Domain with HTTPS enabled

### Required Environment Variables

```env
# Production Environment Variables
# Store these securely in your deployment platform (Vercel, AWS, etc.)

# Database Configuration (PostgreSQL Required)
DATABASE_URL="postgresql://user:password@host:5432/antevus_prod?schema=public&connection_limit=20"
DATABASE_POOL_SIZE=20

# Application Settings
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://app.antevus.com

# Security & Authentication (REQUIRED - Generate strong secrets)
JWT_SECRET=<generate-with-openssl-rand-base64-32>
JWT_EXPIRATION=7d
BCRYPT_ROUNDS=12
SESSION_SECRET=<generate-with-openssl-rand-base64-32>
ENCRYPTION_KEY=<generate-with-openssl-rand-hex-32>

# Rate Limiting (Production Values)
SKIP_RATE_LIMIT=false
RATE_LIMIT_WINDOW=60000           # 1 minute
RATE_LIMIT_MAX_REQUESTS=1000      # Per window
RATE_LIMIT_BLOCK_DURATION=300000  # 5 minutes

# Audit & Compliance
AUDIT_LOG_RETENTION_DAYS=2555     # 7 years for HIPAA
ENABLE_AUDIT_ENCRYPTION=true
AUDIT_HMAC_SECRET=<generate-with-openssl-rand-base64-32>
AUDIT_STORAGE_BACKEND=s3          # or 'database'

# HIPAA/SOC 2 Compliance
ENABLE_HIPAA_MODE=true
ENABLE_DATA_ENCRYPTION=true
ENABLE_ACCESS_LOGGING=true
ENABLE_SESSION_RECORDING=false    # Set true if required
SESSION_TIMEOUT_MINUTES=30
FORCE_HTTPS=true
SECURE_COOKIES=true
SAME_SITE_COOKIES=strict

# Demo Account (Production)
ENABLE_DEMO_ACCOUNT=true
DEMO_ACCOUNT_RATE_LIMIT=10        # Requests per minute
DEMO_ACCOUNT_EXPIRES_HOURS=24     # Auto-disable after 24 hours

# External Services (Optional)
OPENAI_API_KEY=sk-...
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG...

# Monitoring & Analytics
SENTRY_DSN=https://...@sentry.io/...
POSTHOG_API_KEY=phc_...
LOG_LEVEL=info                    # error, warn, info, debug
ENABLE_PERFORMANCE_MONITORING=true

# Storage (for audit logs and data)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_AUDIT_BUCKET=antevus-audit-logs
S3_DATA_BUCKET=antevus-run-data

# CORS Configuration
CORS_ORIGIN=https://app.antevus.com
CORS_CREDENTIALS=true
```

### Generate Secure Secrets

Use these commands to generate cryptographically secure secrets:

```bash
# Generate JWT Secret
openssl rand -base64 32

# Generate Session Secret
openssl rand -base64 32

# Generate Encryption Key (32 bytes hex)
openssl rand -hex 32

# Generate HMAC Secret for Audit Logs
openssl rand -base64 32
```

---

## Security & Compliance

### HIPAA Compliance Requirements

#### Technical Safeguards (Required)

1. **Access Control** ✅
   - Unique user identification
   - Automatic logoff after 30 minutes
   - Encryption and decryption

2. **Audit Controls** ✅
   - Hardware, software, and procedural mechanisms
   - Record and examine access logs
   - 7-year retention policy

3. **Integrity Controls** ✅
   - Electronic mechanisms to verify ePHI
   - HMAC-SHA256 for audit logs
   - Tamper-evident logging

4. **Transmission Security** ✅
   - Encryption in transit (TLS 1.3)
   - Encryption at rest (AES-256)
   - Integrity controls

#### Implementation Checklist

- [x] SSL/TLS for all connections
- [x] Encrypted database connections
- [x] Audit logging for all PHI access
- [x] Automatic session timeout
- [x] Strong password requirements
- [x] Rate limiting and DDoS protection
- [x] Regular security updates
- [x] Backup and disaster recovery

### SOC 2 Type II Requirements

#### Security Criteria

1. **CC1: Control Environment** ✅
   - Documented security policies
   - Risk assessment procedures
   - Security awareness training

2. **CC2: Communication** ✅
   - Security commitments to users
   - Internal security communication
   - Incident response procedures

3. **CC3: Risk Assessment** ✅
   - Annual risk assessments
   - Vulnerability scanning
   - Penetration testing

4. **CC4: Monitoring** ✅
   - Continuous monitoring
   - Alert mechanisms
   - Performance metrics

5. **CC5: Control Activities** ✅
   - Change management
   - Access controls
   - System monitoring

6. **CC6: Logical Access** ✅
   - User provisioning/deprovisioning
   - Role-based access control
   - Multi-factor authentication ready

7. **CC7: System Operations** ✅
   - Incident response
   - Backup procedures
   - Capacity planning

8. **CC8: Change Management** ✅
   - Development standards
   - Testing requirements
   - Deployment procedures

9. **CC9: Risk Mitigation** ✅
   - Business continuity
   - Disaster recovery
   - Insurance coverage

### Production Security Checklist

#### Application Security
- [x] Input validation and sanitization
- [x] XSS protection
- [x] CSRF protection
- [x] SQL injection prevention
- [x] Rate limiting
- [x] Security headers (CSP, HSTS, etc.)

#### Infrastructure Security
- [ ] WAF (Web Application Firewall)
- [ ] DDoS protection
- [ ] Network segmentation
- [ ] VPN for admin access
- [ ] Intrusion detection system

#### Data Security
- [x] Encryption at rest
- [x] Encryption in transit
- [x] Key management system
- [x] Data classification
- [x] PII/PHI redaction

#### Access Control
- [x] Role-based access control (RBAC)
- [x] Principle of least privilege
- [x] Regular access reviews
- [ ] Multi-factor authentication
- [x] Session management

#### Monitoring & Logging
- [x] Centralized logging
- [x] Security event monitoring
- [x] Anomaly detection
- [x] Incident response plan
- [x] Audit trail integrity

---

## Demo Account Configuration

### Production Demo Account

The demo admin account is maintained in production for sales demos and evaluations with the following security controls:

#### Configuration

```env
# Demo Account Settings
ENABLE_DEMO_ACCOUNT=true
DEMO_ACCOUNT_EMAIL=admin@antevus.com
DEMO_ACCOUNT_RATE_LIMIT=10        # 10 requests per minute
DEMO_ACCOUNT_EXPIRES_HOURS=24     # Auto-disable after 24 hours
DEMO_ACCOUNT_RESTRICTED_IPS=      # Optional: Comma-separated IP whitelist
```

#### Security Controls

1. **Rate Limiting**: Stricter limits than regular accounts
2. **Time-based Expiry**: Automatically disabled after 24 hours
3. **Limited Permissions**: Cannot access real production data
4. **Audit Logging**: All demo actions are logged
5. **Data Isolation**: Demo account uses sandboxed data
6. **No PHI Access**: Cannot access any real patient data

#### Demo Account Credentials

```
Email: admin@antevus.com
Password: admin123
Role: Admin (sandboxed)
```

⚠️ **Important**: The demo account:
- Has full UI access but limited backend permissions
- Cannot modify production configurations
- Cannot access real instrument data
- Is clearly marked as "DEMO" in the UI
- Has all actions logged for security audit

### Enabling/Disabling Demo Account

```bash
# Enable demo account (production)
ENABLE_DEMO_ACCOUNT=true

# Disable demo account (production)
ENABLE_DEMO_ACCOUNT=false
```

---

## Troubleshooting

### Common Development Issues

#### Issue: Rate limit errors in development
**Solution**: Ensure `SKIP_RATE_LIMIT=true` in `.env.local`

#### Issue: Database connection errors
**Solution**: Check `DATABASE_URL` is set correctly
```bash
# For development (SQLite)
DATABASE_URL="file:./dev.db"

# For production (PostgreSQL)
DATABASE_URL="postgresql://..."
```

#### Issue: Audit log spam in console
**Solution**: Set `DISABLE_AUDIT_CONSOLE=true` in `.env.local`

#### Issue: Authentication not working
**Solution**: Verify `JWT_SECRET` is set and restart server

### Common Production Issues

#### Issue: CORS errors
**Solution**: Set `CORS_ORIGIN` to your production domain

#### Issue: Session timeout too short/long
**Solution**: Adjust `SESSION_TIMEOUT_MINUTES` (HIPAA recommends ≤30)

#### Issue: Audit logs not persisting
**Solution**: Check `AUDIT_STORAGE_BACKEND` and AWS/database credentials

#### Issue: Demo account not working
**Solution**: Verify `ENABLE_DEMO_ACCOUNT=true` and check rate limits

### Health Checks

```bash
# Check application health
curl https://app.antevus.com/api/health

# Check database connection
curl https://app.antevus.com/api/health/db

# Check audit system
curl https://app.antevus.com/api/health/audit
```

---

## Security Best Practices

### Development
1. Never commit `.env.local` or secrets to git
2. Use different secrets for dev/staging/production
3. Regularly update dependencies
4. Run security audits: `npm audit`

### Production
1. Use strong, unique secrets (32+ characters)
2. Rotate secrets regularly (every 90 days)
3. Enable all security headers
4. Use HTTPS everywhere
5. Implement rate limiting
6. Monitor for anomalies
7. Regular security assessments
8. Maintain audit logs for 7 years (HIPAA)

### Secret Management
- Use environment variables, never hardcode
- Use a secret management service (AWS Secrets Manager, HashiCorp Vault)
- Implement secret rotation
- Audit secret access

---

## Deployment Checklist

### Pre-Deployment
- [ ] All environment variables configured
- [ ] Secrets generated and stored securely
- [ ] Database migrations run
- [ ] SSL certificates configured
- [ ] Domain DNS configured
- [ ] Health checks passing

### Security
- [ ] HTTPS enforced
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] Audit logging enabled
- [ ] Encryption keys set
- [ ] Demo account configured (if needed)

### Compliance
- [ ] HIPAA mode enabled
- [ ] Audit retention set to 7 years
- [ ] Access logging enabled
- [ ] Data encryption verified
- [ ] Session timeout configured
- [ ] Terms of Service updated

### Monitoring
- [ ] Error tracking (Sentry) configured
- [ ] Analytics (PostHog) configured
- [ ] Log aggregation setup
- [ ] Alerts configured
- [ ] Backup strategy implemented

### Post-Deployment
- [ ] Verify all health checks
- [ ] Test demo account (if enabled)
- [ ] Verify audit logging
- [ ] Check rate limiting
- [ ] Security scan
- [ ] Document deployment

---

## Support

For questions or issues:
- GitHub: https://github.com/gabeviggers/antevus-app
- Email: support@antevus.com
- Documentation: https://docs.antevus.com

---

*Last Updated: January 2025*
*Version: 1.0.0*