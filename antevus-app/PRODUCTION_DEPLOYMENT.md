# Production Deployment Guide

## Overview

This guide covers deploying Antevus to production with HIPAA and SOC 2 compliance. Follow these steps carefully to ensure a secure, compliant deployment.

**Deployment Platforms Supported:**
- ✅ Vercel (Recommended)
- ✅ AWS (ECS/EKS)
- ✅ Google Cloud (Cloud Run)
- ✅ Azure (App Service)

---

## Pre-Deployment Checklist

### Required Services
- [ ] PostgreSQL database (v14+)
- [ ] SSL certificate (EV recommended)
- [ ] Domain with DNS access
- [ ] CDN (CloudFront/Cloudflare)
- [ ] Object storage (S3) for audit logs
- [ ] Email service (SendGrid)
- [ ] Monitoring (Sentry)

### Security Requirements
- [ ] All secrets generated (32+ characters)
- [ ] Database encrypted at rest
- [ ] SSL/TLS configured
- [ ] WAF enabled
- [ ] DDoS protection active
- [ ] Backup strategy defined

---

## Step 1: Environment Setup

### Generate Production Secrets

```bash
# Generate all required secrets
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "SESSION_SECRET=$(openssl rand -base64 32)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "AUDIT_HMAC_SECRET=$(openssl rand -base64 32)"
```

### Configure Database

#### PostgreSQL Setup
```sql
-- Create production database
CREATE DATABASE antevus_prod;

-- Create application user
CREATE USER antevus_app WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT CONNECT ON DATABASE antevus_prod TO antevus_app;
GRANT USAGE ON SCHEMA public TO antevus_app;
GRANT CREATE ON SCHEMA public TO antevus_app;

-- Enable required extensions
\c antevus_prod;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

#### Connection String
```env
DATABASE_URL="postgresql://antevus_app:password@host:5432/antevus_prod?schema=public&connection_limit=20&pool_timeout=10"
```

---

## Step 2: Vercel Deployment

### Install Vercel CLI
```bash
npm install -g vercel
```

### Configure Project
```bash
# Login to Vercel
vercel login

# Link project
vercel link

# Set environment variables
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production
vercel env add SESSION_SECRET production
# ... add all required variables
```

### Deploy to Production
```bash
# Build and deploy
vercel --prod

# Or with GitHub integration
git push origin main
```

### Vercel Configuration
Create `vercel.json`:
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "env": {
    "NODE_ENV": "production"
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ]
}
```

---

## Step 3: Database Migration

### Run Migrations
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed initial data (optional)
npx prisma db seed
```

### Verify Database
```bash
# Test connection
npx prisma db execute --sql "SELECT 1"

# Check tables
npx prisma studio
```

---

## Step 4: Security Configuration

### SSL/TLS Setup

#### Vercel (Automatic)
- SSL certificates are automatically provisioned
- Force HTTPS in environment:
```env
FORCE_HTTPS=true
```

#### Custom Domain
```bash
# Add custom domain
vercel domains add app.antevus.com

# Verify DNS
vercel domains inspect app.antevus.com
```

### WAF Configuration

#### Cloudflare Setup
1. Add domain to Cloudflare
2. Enable WAF rules:
   - SQL injection protection
   - XSS protection
   - Rate limiting
3. Configure DDoS protection
4. Set security level to "High"

### Security Headers
Verify headers are set:
```bash
curl -I https://app.antevus.com | grep -E "Strict-Transport|X-Content-Type|X-Frame"
```

---

## Step 5: Compliance Setup

### Enable HIPAA Mode
Set in production environment:
```env
ENABLE_HIPAA_MODE=true
ENABLE_DATA_ENCRYPTION=true
ENABLE_ACCESS_LOGGING=true
AUDIT_LOG_RETENTION_DAYS=2555
```

### Configure Audit Logging

#### S3 Setup for Audit Logs
```bash
# Create S3 bucket with versioning and encryption
aws s3api create-bucket \
  --bucket antevus-audit-logs-prod \
  --region us-east-1 \
  --object-lock-enabled-for-bucket

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket antevus-audit-logs-prod \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket antevus-audit-logs-prod \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Set lifecycle policy for 7-year retention
aws s3api put-bucket-lifecycle-configuration \
  --bucket antevus-audit-logs-prod \
  --lifecycle-configuration file://lifecycle.json
```

### Session Security
Configure session timeout:
```env
SESSION_TIMEOUT_MINUTES=30
SECURE_COOKIES=true
SAME_SITE_COOKIES=strict
```

---

## Step 6: Demo Account Setup

### Enable Demo Account
```env
ENABLE_DEMO_ACCOUNT=true
DEMO_ACCOUNT_EMAIL=admin@antevus.com
DEMO_ACCOUNT_RATE_LIMIT=10
DEMO_ACCOUNT_EXPIRES_HOURS=24
DEMO_ACCOUNT_SANDBOXED=true
```

### Verify Demo Account
```bash
# Test login
curl -X POST https://app.antevus.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@antevus.com","password":"AntevusDemo2024!SecureAccess#"}'
```

---

## Step 7: Monitoring Setup

### Sentry Configuration
```env
SENTRY_DSN=https://your-key@sentry.io/project-id
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### Health Checks
Create health check endpoints:
```typescript
// app/api/health/route.ts
export async function GET() {
  return Response.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  })
}
```

### Uptime Monitoring
Configure monitoring service:
- Endpoint: `https://app.antevus.com/api/health`
- Frequency: Every 5 minutes
- Alert threshold: 2 consecutive failures

---

## Step 8: Backup Configuration

### Database Backup
```bash
# Setup automated backups
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Upload to S3
aws s3 cp backup-*.sql s3://antevus-backups/database/
```

### Backup Schedule
```cron
# Crontab for automated backups
0 */6 * * * /usr/local/bin/backup.sh  # Every 6 hours
```

---

## Step 9: Performance Optimization

### CDN Configuration
```env
# Vercel Edge Network (automatic)
# Or configure CloudFront/Cloudflare
CDN_URL=https://cdn.antevus.com
```

### Caching Strategy
```typescript
// next.config.js
module.exports = {
  images: {
    domains: ['app.antevus.com'],
  },
  headers: async () => [
    {
      source: '/api/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'no-store, must-revalidate',
        },
      ],
    },
  ],
}
```

---

## Step 10: Go Live

### Final Checks
- [ ] All environment variables set
- [ ] Database migrations complete
- [ ] SSL certificate active
- [ ] Health checks passing
- [ ] Monitoring configured
- [ ] Backups tested
- [ ] Demo account working
- [ ] Rate limiting active
- [ ] Audit logging verified

### DNS Cutover
```bash
# Update DNS records
A     app.antevus.com  -> Vercel IP
CNAME www.antevus.com  -> app.antevus.com
```

### Smoke Tests
```bash
# Run production smoke tests
npm run test:production

# Verify critical paths
- Login flow
- Dashboard loading
- API endpoints
- Audit logging
```

---

## Post-Deployment

### Monitor First 24 Hours
- [ ] Check error rates
- [ ] Monitor performance metrics
- [ ] Review audit logs
- [ ] Verify backup completion
- [ ] Check rate limiting

### Documentation
- [ ] Update API documentation
- [ ] Record deployment details
- [ ] Update runbooks
- [ ] Notify stakeholders

### Security Scan
```bash
# Run security scan
npm audit --production

# Check SSL configuration
nmap --script ssl-enum-ciphers -p 443 app.antevus.com

# Verify headers
curl -I https://app.antevus.com
```

---

## Rollback Procedure

### Immediate Rollback
```bash
# Vercel rollback
vercel rollback

# Or revert git commit
git revert HEAD
git push origin main
```

### Database Rollback
```bash
# Restore from backup
psql $DATABASE_URL < backup-latest.sql
```

---

## Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check connection
psql $DATABASE_URL -c "SELECT 1"

# Verify SSL mode
DATABASE_URL="...?sslmode=require"
```

#### Rate Limiting Issues
```bash
# Temporarily increase limits
RATE_LIMIT_MAX_REQUESTS=5000
```

#### Session Issues
```bash
# Verify cookies
curl -I https://app.antevus.com -c cookies.txt
```

---

## Maintenance Mode

### Enable Maintenance
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  if (process.env.MAINTENANCE_MODE === 'true') {
    return NextResponse.rewrite(new URL('/maintenance', request.url))
  }
}
```

### Maintenance Page
```html
<!-- app/maintenance/page.tsx -->
<div>
  <h1>Scheduled Maintenance</h1>
  <p>We'll be back shortly.</p>
</div>
```

---

## Support Contacts

| Issue Type | Contact | Response Time |
|------------|---------|---------------|
| Critical Production Issue | ops@antevus.com | <15 min |
| Security Incident | security@antevus.com | <15 min |
| Database Issues | dba@antevus.com | <30 min |
| General Support | support@antevus.com | <2 hours |

---

## Compliance Validation

### HIPAA Checklist
- [ ] Encryption at rest enabled
- [ ] Encryption in transit (TLS 1.3)
- [ ] Audit logging active
- [ ] Session timeout ≤30 minutes
- [ ] Access controls configured
- [ ] Backup encryption enabled

### SOC 2 Checklist
- [ ] Change management process
- [ ] Access reviews scheduled
- [ ] Monitoring active
- [ ] Incident response plan
- [ ] Vendor assessments complete
- [ ] Security training records

---

*Last Updated: January 2025*
*Version: 1.0.0*
*Classification: INTERNAL*