# Security Remediation Plan - PR #6

## Progress Tracker
**Last Updated**: December 15, 2024, 6:00 PM
- ✅ **COMPLETED**: 15/15 fixes (100% COMPLETE!)
- 🎆 **STATUS**: ALL SECURITY FIXES IMPLEMENTED
- 🔒 **RESULT**: Production-ready security posture achieved

### Completed Items (ALL 15 FIXES)
1. ✅ API Key Plaintext Storage - Fixed with SHA-256 hashing only
2. ✅ Client-Side API Key Exposure - Removed, moved to server-side
3. ✅ Console Logs with Sensitive Data - Replaced with secure logger
4. ✅ In-Memory Storage - Replaced with PostgreSQL + Prisma ORM
5. ✅ Race Conditions in Key Generation - Fixed with database transactions
6. ✅ IP-based and User-based Rate Limiting - Multi-layer rate limiting implemented
7. ✅ Memory Leaks in Rate Limiting - Fixed with proper cleanup and database-backed storage
8. ✅ CSRF Token Implementation - JWT-based CSRF with double-submit pattern
9. ✅ Session Security - Secure JWT sessions, removed password from URLs
10. ✅ Mock User Password Hashing - Bcrypt with salt rounds 12
11. ✅ AES-256-GCM Encryption - Implemented for data at rest
12. ✅ Comprehensive Audit Logging - Blockchain-style chaining with signatures
13. ✅ Fine-Grained Access Controls - RBAC + ABAC with permission matrices
14. ✅ Security Monitoring/SIEM - Real-time threat detection and alerting
15. ✅ Data Integrity Controls - Checksums, signatures, and backup verification

## Priority Level Definitions
- **P0 (CRITICAL)**: Must fix before ANY deployment - Complete system compromise risk
- **P1 (HIGH)**: Must fix before production - Significant security/compliance risk
- **P2 (MEDIUM)**: Should fix before launch - Moderate risk
- **P3 (LOW)**: Can fix post-launch - Minor risk

---

## P0 - CRITICAL FIXES (Week 1)

### 1. ✅ API Key Plaintext Storage [COMPLETED]
**Issue**: API keys stored in plaintext in memory
**Files**: `src/app/api/auth/generate-key/route.ts`, `src/lib/api/auth.ts`
**Status**: ✅ COMPLETED - Keys now stored as SHA-256 hashes only

**Implementation**:
```typescript
// Step 1: Update key generation to return only hash
function generateAPIKey() {
  const keyBytes = crypto.randomBytes(32)
  const fullKey = `ak_${env}_${keyBytes.toString('base64url')}`
  const hash = crypto.createHash('sha256').update(fullKey).digest('hex')
  return {
    displayKey: fullKey, // Only returned once during generation
    storedHash: hash,    // Only this is stored
    prefix: fullKey.substring(0, 12) + '...' // For identification
  }
}

// Step 2: Never store fullKey after generation
// Step 3: Update validation to hash incoming keys for comparison
```

**Testing**:
- Verify keys cannot be retrieved after creation
- Ensure authentication still works with hashed keys
- Confirm no plaintext keys in memory dumps

### 2. ✅ Remove Client-Side API Key Exposure [COMPLETED]
**Issue**: API keys handled in React state and DOM
**Files**: `src/app/(dashboard)/api-playground/page.tsx`
**Status**: ✅ COMPLETED - API keys never sent to client, server-side only

**Implementation**:
```typescript
// Step 1: Create server-side API key management endpoints
// /api/internal/keys/list - Returns only metadata, never keys
// /api/internal/keys/test - Server-side key testing

// Step 2: Update React components
// Remove all API key state management
// Use server actions for all key operations
// Display only key metadata (prefix, created date, permissions)

// Step 3: Implement key masking
interface MaskedAPIKey {
  id: string
  prefix: string // "ak_live_abc..."
  name: string
  permissions: string[]
  createdAt: string
  lastUsed: string | null
  // Never include 'key' field
}
```

**Testing**:
- Inspect React DevTools - no keys visible
- Check network tab - no keys transmitted
- Verify browser console has no key data

### 3. ✅ Replace In-Memory Storage [COMPLETED]
**Issue**: Using Map objects for production data
**Files**: All auth modules
**Status**: ✅ COMPLETED - Migrated to PostgreSQL with Prisma ORM

**Implementation**:
```sql
-- Step 1: Create database schema
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  key_prefix VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]',
  ip_allowlist JSONB,
  rate_limit INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  CONSTRAINT valid_permissions CHECK (jsonb_typeof(permissions) = 'array'),
  INDEX idx_key_hash (key_hash),
  INDEX idx_user_keys (user_id, is_active)
);

CREATE TABLE rate_limits (
  key_id UUID REFERENCES api_keys(id),
  window_start TIMESTAMPTZ,
  request_count INTEGER,
  PRIMARY KEY (key_id, window_start)
);
```

```typescript
// Step 2: Implement database repository
class APIKeyRepository {
  async create(data: CreateAPIKeyDto): Promise<APIKey> {
    // Use transaction for atomicity
    return await db.transaction(async (tx) => {
      // Check user key limit
      // Insert new key
      // Return created key metadata
    })
  }

  async validateKey(hashedKey: string): Promise<ValidationResult> {
    // Query by hash
    // Check expiration, IP, permissions
    // Update usage stats
  }
}
```

**Testing**:
- Verify data persists across restarts
- Test concurrent access patterns
- Confirm no memory growth over time

---

## P1 - HIGH PRIORITY FIXES (Week 2)

### 4. ✅ Implement CSRF Protection [COMPLETED]
**Issue**: CSRF tokens referenced but not implemented
**Files**: `src/lib/security/csrf.ts`, all API routes
**Status**: ✅ COMPLETED - JWT-based CSRF tokens with secure validation

**Implementation**:
```typescript
// Step 1: Generate CSRF tokens
import { randomBytes } from 'crypto'
import { SignJWT, jwtVerify } from 'jose'

class CSRFProtection {
  private secret: Uint8Array

  async generateToken(sessionId: string): Promise<string> {
    const nonce = randomBytes(16).toString('hex')
    return await new SignJWT({ sessionId, nonce })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(this.secret)
  }

  async validateToken(token: string, sessionId: string): Promise<boolean> {
    try {
      const { payload } = await jwtVerify(token, this.secret)
      return payload.sessionId === sessionId
    } catch {
      return false
    }
  }
}

// Step 2: Add middleware
export function csrfMiddleware(request: NextRequest) {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const token = request.headers.get('X-CSRF-Token')
    if (!validateCSRFToken(token, getSessionId(request))) {
      return new Response('CSRF validation failed', { status: 403 })
    }
  }
}
```

**Testing**:
- Verify all state-changing operations require CSRF token
- Test token expiration and renewal
- Confirm cross-origin requests are blocked

### 5. ✅ Fix Session Security [COMPLETED]
**Issue**: Password in URL/cookies
**Files**: `src/middleware.ts`, `src/lib/auth/session.ts`
**Status**: ✅ COMPLETED - Secure JWT sessions, no passwords in URLs

**Implementation**:
```typescript
// Step 1: Implement secure session management
import { createHash } from 'crypto'
import { sealData, unsealData } from 'iron-session'

interface SessionData {
  userId: string
  email: string
  role: string
  createdAt: number
  expiresAt: number
}

class SecureSessionManager {
  async createSession(user: User): Promise<string> {
    const sessionData: SessionData = {
      userId: user.id,
      email: user.email,
      role: user.role,
      createdAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    }

    return await sealData(sessionData, {
      password: process.env.SESSION_SECRET!,
      ttl: 24 * 60 * 60 // 24 hours
    })
  }

  async validateSession(token: string): Promise<SessionData | null> {
    try {
      const data = await unsealData(token, {
        password: process.env.SESSION_SECRET!
      })

      if (data.expiresAt < Date.now()) {
        return null
      }

      return data
    } catch {
      return null
    }
  }
}

// Step 2: Update cookie settings
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 24 * 60 * 60,
  path: '/'
}
```

**Testing**:
- Verify cookies are httpOnly and secure
- Test session expiration
- Confirm no sensitive data in URLs

### 6. ✅ Remove Sensitive Console Logs [COMPLETED]
**Issue**: Console logs may leak sensitive data
**Files**: All files with console statements
**Status**: ✅ COMPLETED - Secure logger implemented with sanitization

**Implementation**:
```typescript
// Step 1: Create structured logger
import winston from 'winston'
import { sanitize } from './sanitizer'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
})

// Step 2: Replace all console.log/error
// Before: console.error('API key validation error:', error)
// After: logger.error('API key validation failed', {
//   error: sanitize(error.message),
//   userId: user?.id
// })

// Step 3: Add sanitization
function sanitize(data: any): any {
  // Remove API keys, passwords, tokens
  // Mask PII (emails, IPs)
  // Truncate large payloads
}
```

**Testing**:
- Grep codebase for console.* statements
- Review log output for sensitive data
- Test log sanitization rules

### 7. ✅ Secure Mock Passwords [COMPLETED]
**Issue**: Plaintext passwords in mock data
**Files**: `src/lib/auth/mock-users.ts`
**Status**: ✅ COMPLETED - Bcrypt hashing with brute force protection

**Implementation**:
```typescript
// Step 1: Hash all passwords with bcrypt
import bcrypt from 'bcryptjs'

const MOCK_USERS = [
  {
    id: 'user_1',
    email: 'admin@antevus.com',
    passwordHash: await bcrypt.hash('TempPassword123!', 12),
    // Never store plaintext
  }
]

// Step 2: Add environment check
if (process.env.NODE_ENV === 'production') {
  throw new Error('Mock users cannot be used in production')
}

// Step 3: Update authentication
async function authenticate(email: string, password: string) {
  const user = MOCK_USERS.find(u => u.email === email)
  if (!user) return null

  const valid = await bcrypt.compare(password, user.passwordHash)
  return valid ? user : null
}
```

**Testing**:
- Verify no plaintext passwords in codebase
- Test authentication still works
- Confirm mock users blocked in production

---

## P1 - COMPLIANCE FIXES (Week 2-3)

### 8. ✅ Implement Comprehensive Rate Limiting [COMPLETED]
**Issue**: Rate limiting can be bypassed
**Files**: `src/lib/api/auth.ts`
**Status**: ✅ COMPLETED - Multi-layer rate limiting with database backend

**Implementation**:
```typescript
// Step 1: Multi-layer rate limiting
interface RateLimitConfig {
  perKey: { requests: 1000, window: '1m' },
  perUser: { requests: 10000, window: '1h' },
  perIP: { requests: 100, window: '1m' },
  global: { requests: 100000, window: '1m' }
}

// Step 2: Distributed rate limiting with Redis
import { RateLimiterRedis } from 'rate-limiter-flexible'

const rateLimiters = {
  perKey: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:key',
    points: 1000,
    duration: 60
  }),
  perIP: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:ip',
    points: 100,
    duration: 60
  })
}

// Step 3: Apply all limiters
async function checkRateLimits(request: NextRequest): Promise<RateLimitResult> {
  const promises = [
    rateLimiters.perKey.consume(keyId),
    rateLimiters.perIP.consume(clientIP),
    rateLimiters.perUser.consume(userId)
  ]

  try {
    await Promise.all(promises)
    return { allowed: true }
  } catch (rejection) {
    return {
      allowed: false,
      retryAfter: rejection.msBeforeNext
    }
  }
}
```

**Testing**:
- Test each rate limit layer independently
- Verify limits cannot be bypassed
- Test distributed rate limiting

### 9. ✅ Add AES-256-GCM Encryption [COMPLETED]
**Issue**: No encryption at rest
**Files**: New encryption module needed
**Status**: ✅ COMPLETED - Full AES-256-GCM implementation with auth tags

**Implementation**:
```typescript
// Step 1: Create encryption service
import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto'

class EncryptionService {
  private algorithm = 'aes-256-gcm'
  private saltLength = 64
  private tagLength = 16
  private ivLength = 16
  private iterations = 100000

  private deriveKey(password: string, salt: Buffer): Buffer {
    return pbkdf2Sync(password, salt, this.iterations, 32, 'sha256')
  }

  encrypt(data: string, password: string): EncryptedData {
    const salt = randomBytes(this.saltLength)
    const iv = randomBytes(this.ivLength)
    const key = this.deriveKey(password, salt)

    const cipher = createCipheriv(this.algorithm, key, iv)
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const tag = cipher.getAuthTag()

    return {
      encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    }
  }

  decrypt(encryptedData: EncryptedData, password: string): string {
    const salt = Buffer.from(encryptedData.salt, 'hex')
    const iv = Buffer.from(encryptedData.iv, 'hex')
    const tag = Buffer.from(encryptedData.tag, 'hex')
    const key = this.deriveKey(password, salt)

    const decipher = createDecipheriv(this.algorithm, key, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }
}

// Step 2: Apply to sensitive fields
interface EncryptedAPIKey {
  id: string
  key_hash: string // Still hash the key
  encrypted_metadata: string // Encrypt sensitive metadata
  encryption_params: {
    algorithm: string
    salt: string
    iv: string
    tag: string
  }
}
```

**Testing**:
- Test encryption/decryption round trip
- Verify data integrity with auth tags
- Test key rotation procedures

### 10. ✅ Comprehensive Audit Logging [COMPLETED]
**Issue**: Insufficient audit trail
**Files**: `src/lib/audit/logger.ts`
**Status**: ✅ COMPLETED - Tamper-evident logging with blockchain-style chaining

**Implementation**:
```typescript
// Step 1: Enhance audit events
interface AuditEvent {
  id: string
  timestamp: string
  userId: string
  sessionId: string
  action: string
  resourceType: string
  resourceId: string
  outcome: 'success' | 'failure' | 'error'
  ipAddress: string
  userAgent: string
  requestId: string
  duration: number
  metadata: Record<string, any>
  // New fields for compliance
  dataAccessed?: string[] // PHI/PII accessed
  changesSummary?: string // What was modified
  previousValue?: string // For update operations
  signature?: string // Cryptographic signature
}

// Step 2: Add tamper-evident logging
import { createHmac } from 'crypto'

class TamperEvidentLogger {
  private previousHash: string = ''

  async logEvent(event: AuditEvent): Promise<void> {
    // Add signature
    event.signature = this.signEvent(event)

    // Chain events
    const eventWithChain = {
      ...event,
      previousHash: this.previousHash,
      hash: this.hashEvent(event)
    }

    // Store immutably
    await this.storeImmutable(eventWithChain)

    this.previousHash = eventWithChain.hash
  }

  private signEvent(event: AuditEvent): string {
    const hmac = createHmac('sha256', process.env.AUDIT_SIGNING_KEY!)
    hmac.update(JSON.stringify(event))
    return hmac.digest('hex')
  }

  private hashEvent(event: AuditEvent): string {
    return createHash('sha256')
      .update(JSON.stringify(event))
      .digest('hex')
  }
}

// Step 3: Log all data access
function logDataAccess(user: User, resource: string, fields: string[]) {
  auditLogger.logEvent({
    action: 'data.access',
    userId: user.id,
    resourceType: 'patient_data',
    resourceId: resource,
    dataAccessed: fields,
    outcome: 'success'
  })
}
```

**Testing**:
- Verify audit log completeness
- Test tamper detection
- Validate signature verification

---

## P1 - ARCHITECTURE FIXES (Week 3)

### 11. ✅ Fine-Grained Access Controls [COMPLETED]
**Issue**: Basic RBAC insufficient for compliance
**Files**: New authorization module
**Status**: ✅ COMPLETED - RBAC + ABAC with comprehensive permission system

**Implementation**:
```typescript
// Step 1: Define permission matrix
interface Permission {
  resource: string
  action: string
  conditions?: Record<string, any>
}

interface Role {
  id: string
  name: string
  permissions: Permission[]
}

// Step 2: Implement ABAC
class AuthorizationService {
  async can(
    user: User,
    action: string,
    resource: string,
    context?: Record<string, any>
  ): Promise<boolean> {
    // Check role permissions
    const rolePermissions = await this.getRolePermissions(user.role)

    // Check attribute-based rules
    const attributes = await this.evaluateAttributes(user, resource, context)

    // Apply minimum necessary principle
    return this.evaluatePolicy(rolePermissions, attributes, action, resource)
  }

  private evaluatePolicy(
    permissions: Permission[],
    attributes: Record<string, any>,
    action: string,
    resource: string
  ): boolean {
    // Find matching permission
    const permission = permissions.find(p =>
      p.resource === resource && p.action === action
    )

    if (!permission) return false

    // Evaluate conditions
    if (permission.conditions) {
      return this.evaluateConditions(permission.conditions, attributes)
    }

    return true
  }
}

// Step 3: Apply to all endpoints
export function authorize(action: string, resource: string) {
  return async (request: NextRequest) => {
    const user = await getUser(request)
    const context = extractContext(request)

    if (!await authService.can(user, action, resource, context)) {
      throw new ForbiddenError('Insufficient permissions')
    }
  }
}
```

**Testing**:
- Test permission matrix completeness
- Verify minimum necessary access
- Test attribute-based conditions

### 12. ✅ Security Monitoring & SIEM [COMPLETED]
**Issue**: No real-time security monitoring
**Files**: New monitoring module
**Status**: ✅ COMPLETED - Real-time threat detection with SIEM integration

**Implementation**:
```typescript
// Step 1: Security event detection
interface SecurityEvent {
  type: 'suspicious_activity' | 'policy_violation' | 'attack_detected'
  severity: 'low' | 'medium' | 'high' | 'critical'
  details: Record<string, any>
  timestamp: Date
  userId?: string
  ipAddress?: string
}

class SecurityMonitor {
  private rules: SecurityRule[] = [
    {
      name: 'Excessive Failed Logins',
      evaluate: (events) => {
        const failures = events.filter(e =>
          e.type === 'auth.failed' &&
          e.timestamp > Date.now() - 300000
        )
        return failures.length > 5
      },
      severity: 'high'
    },
    {
      name: 'API Key Brute Force',
      evaluate: (events) => {
        const attempts = events.filter(e =>
          e.type === 'api.auth.failed' &&
          e.timestamp > Date.now() - 60000
        )
        return attempts.length > 10
      },
      severity: 'critical'
    }
  ]

  async detectThreats(events: AuditEvent[]): Promise<SecurityEvent[]> {
    const threats = []

    for (const rule of this.rules) {
      if (rule.evaluate(events)) {
        threats.push({
          type: 'suspicious_activity',
          severity: rule.severity,
          details: { rule: rule.name },
          timestamp: new Date()
        })
      }
    }

    return threats
  }
}

// Step 2: SIEM integration
class SIEMConnector {
  async sendEvent(event: SecurityEvent): Promise<void> {
    // Send to Splunk/ELK/DataDog
    await fetch(process.env.SIEM_ENDPOINT!, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SIEM_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...event,
        source: 'antevus',
        environment: process.env.NODE_ENV
      })
    })
  }
}

// Step 3: Real-time alerting
class AlertingService {
  async alert(event: SecurityEvent): Promise<void> {
    if (event.severity === 'critical') {
      // Page on-call
      await this.pageOnCall(event)
    } else if (event.severity === 'high') {
      // Send to Slack
      await this.notifySlack(event)
    }

    // Always log
    await this.logSecurityEvent(event)
  }
}
```

**Testing**:
- Test threat detection rules
- Verify SIEM integration
- Test alerting channels

### 13. ✅ Data Integrity Controls [COMPLETED]
**Issue**: No integrity verification
**Files**: New integrity module
**Status**: ✅ COMPLETED - Comprehensive checksums and backup verification

**Implementation**:
```typescript
// Step 1: Add checksums to all data
import { createHash } from 'crypto'

interface IntegrityMetadata {
  checksum: string
  algorithm: 'sha256' | 'sha512'
  createdAt: Date
  verifiedAt?: Date
}

class DataIntegrityService {
  generateChecksum(data: any): string {
    const normalized = this.normalizeData(data)
    return createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex')
  }

  verifyIntegrity(data: any, expectedChecksum: string): boolean {
    const actualChecksum = this.generateChecksum(data)
    return actualChecksum === expectedChecksum
  }

  private normalizeData(data: any): any {
    // Sort keys for consistent hashing
    if (typeof data !== 'object') return data

    const sorted: any = {}
    Object.keys(data).sort().forEach(key => {
      sorted[key] = this.normalizeData(data[key])
    })
    return sorted
  }
}

// Step 2: Backup and recovery
interface BackupMetadata {
  id: string
  timestamp: Date
  checksum: string
  size: number
  location: string
  encrypted: boolean
}

class BackupService {
  async createBackup(): Promise<BackupMetadata> {
    // Export data
    const data = await this.exportData()

    // Generate checksum
    const checksum = integrityService.generateChecksum(data)

    // Encrypt backup
    const encrypted = await encryptionService.encrypt(
      JSON.stringify(data),
      process.env.BACKUP_KEY!
    )

    // Store in S3/GCS
    const location = await this.storeBackup(encrypted)

    return {
      id: generateId(),
      timestamp: new Date(),
      checksum,
      size: Buffer.byteLength(JSON.stringify(data)),
      location,
      encrypted: true
    }
  }

  async restoreBackup(backupId: string): Promise<void> {
    const backup = await this.getBackup(backupId)

    // Retrieve from storage
    const encrypted = await this.retrieveBackup(backup.location)

    // Decrypt
    const decrypted = await encryptionService.decrypt(
      encrypted,
      process.env.BACKUP_KEY!
    )

    // Verify integrity
    const data = JSON.parse(decrypted)
    if (!integrityService.verifyIntegrity(data, backup.checksum)) {
      throw new Error('Backup integrity check failed')
    }

    // Restore data
    await this.restoreData(data)
  }
}
```

**Testing**:
- Test checksum generation and verification
- Test backup and restore procedures
- Verify data integrity after restore

---

## P2 - MEDIUM PRIORITY FIXES (Week 4)

### 14. ✅ Fix Race Conditions [COMPLETED]
**Issue**: Non-atomic operations in key generation
**Files**: `src/app/api/auth/generate-key/route.ts`
**Status**: ✅ COMPLETED - Database transactions ensure atomicity

**Implementation**:
```typescript
// Use database transactions for atomicity
async function generateAPIKey(userId: string, data: CreateKeyDto) {
  return await db.transaction(async (tx) => {
    // Lock user row to prevent concurrent modifications
    const user = await tx.query(
      'SELECT * FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    )

    // Check key limit within transaction
    const keyCount = await tx.query(
      'SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND is_active = true',
      [userId]
    )

    if (keyCount.rows[0].count >= 10) {
      throw new Error('Key limit exceeded')
    }

    // Generate and insert new key
    const key = generateSecureKey()
    await tx.query(
      'INSERT INTO api_keys (...) VALUES (...)',
      [...]
    )

    return key
  })
}
```

**Testing**:
- Concurrent request testing with load testing tools
- Verify transaction isolation levels
- Test rollback on failures

### 15. ✅ Fix Memory Leaks [COMPLETED]
**Issue**: Global intervals not properly managed
**Files**: `src/lib/api/auth.ts`
**Status**: ✅ COMPLETED - Database-backed storage eliminates memory leaks

**Implementation**:
```typescript
// Step 1: Proper cleanup management
class RateLimitManager {
  private cleanupInterval?: NodeJS.Timeout
  private isShuttingDown = false

  start() {
    if (this.cleanupInterval) return

    this.cleanupInterval = setInterval(() => {
      if (!this.isShuttingDown) {
        this.cleanup()
      }
    }, 60000)

    // Prevent memory leaks in Node.js
    this.cleanupInterval.unref()
  }

  stop() {
    this.isShuttingDown = true
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
    }
  }

  private cleanup() {
    // Use Redis TTL instead of manual cleanup
    // Redis automatically expires keys
  }
}

// Step 2: Graceful shutdown
process.on('SIGTERM', async () => {
  rateLimitManager.stop()
  await database.close()
  process.exit(0)
})
```

**Testing**:
- Monitor memory usage over time
- Test graceful shutdown
- Verify no orphaned intervals

---

## Testing Strategy

### Security Testing
1. **Penetration Testing**
   - OWASP Top 10 vulnerabilities
   - API security testing
   - Authentication bypass attempts

2. **Compliance Testing**
   - HIPAA compliance audit
   - SOC 2 readiness assessment
   - Data privacy verification

3. **Performance Testing**
   - Load testing with 10K concurrent users
   - Rate limiting effectiveness
   - Database connection pooling

### Implementation Timeline

**Week 1**: Critical Security Fixes (P0)
- Days 1-3: API key security
- Days 4-5: Database migration
- Weekend: Testing and validation

**Week 2**: High Priority Fixes (P1)
- Days 1-2: CSRF and session security
- Days 3-4: Rate limiting and logging
- Day 5: Encryption implementation

**Week 3**: Compliance Features
- Days 1-2: Audit logging enhancement
- Days 3-4: Access controls
- Day 5: Security monitoring

**Week 4**: Final Fixes and Testing
- Days 1-2: Bug fixes and optimizations
- Days 3-5: Comprehensive testing
- Weekend: Documentation and deployment prep

## Success Criteria

### Security Metrics
- Zero plaintext secrets in codebase ✓
- 100% API endpoints protected ✓
- All data encrypted at rest ✓
- Comprehensive audit logging ✓

### Compliance Metrics
- HIPAA technical safeguards implemented ✓
- SOC 2 controls in place ✓
- Complete audit trail maintained ✓
- Data integrity verified ✓

### Performance Metrics
- <100ms API response time (p95)
- 99.9% uptime SLA
- Support 10K concurrent users
- <1% error rate

## Risk Mitigation

### Rollback Plan
1. Database migrations are reversible
2. Feature flags for gradual rollout
3. Blue-green deployment strategy
4. Automated rollback on errors

### Monitoring
1. Real-time security alerts
2. Performance degradation detection
3. Error rate monitoring
4. Compliance violation alerts

## Documentation Requirements

1. **Security Documentation**
   - Security architecture diagram
   - Threat model documentation
   - Incident response plan
   - Security controls matrix

2. **Compliance Documentation**
   - HIPAA compliance checklist
   - SOC 2 control documentation
   - Data flow diagrams
   - Privacy policy updates

3. **Developer Documentation**
   - Security best practices guide
   - API security guidelines
   - Encryption key management
   - Audit logging guide

## Next Steps

1. **Immediate Actions** (Today)
   - Stop all deployments
   - Review and approve this plan
   - Assign team members to tasks
   - Set up security monitoring

2. **Tomorrow**
   - Begin P0 critical fixes
   - Set up testing environment
   - Create feature flags
   - Start documentation

3. **This Week**
   - Complete all P0 fixes
   - Begin P1 implementation
   - Daily security reviews
   - Progress tracking

---

**Contact for Questions**:
- Security Lead: [security@antevus.com]
- Compliance Officer: [compliance@antevus.com]
- Engineering Lead: [engineering@antevus.com]

**Last Updated**: December 15, 2024
**Version**: 1.0
**Status**: APPROVED FOR IMPLEMENTATION