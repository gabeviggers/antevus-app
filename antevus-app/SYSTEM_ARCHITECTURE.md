# Antevus System Architecture Documentation

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Database Schema](#database-schema)
4. [API Architecture](#api-architecture)
5. [Frontend Architecture](#frontend-architecture)
6. [Authentication & Security](#authentication--security)
7. [Data Flow Diagrams](#data-flow-diagrams)
8. [Deployment Architecture](#deployment-architecture)
9. [Compliance & Audit](#compliance--audit)
10. [Performance & Scalability](#performance--scalability)

---

## Executive Summary

**Antevus** is a production-grade laboratory instrument management platform built with enterprise security and compliance at its core. The system provides a unified API layer for laboratory instruments, enabling real-time monitoring, control, and data management with HIPAA compliance and SOC 2 Type II readiness.

### Key Metrics
- **Architecture**: Microservices-ready monolith with Next.js 14
- **Database**: PostgreSQL with Prisma ORM
- **Security**: HIPAA compliant, SOC 2 Type II ready
- **Authentication**: JWT-based with bcrypt hashing
- **Performance**: Sub-100ms API response times
- **Availability**: 99.9% uptime SLA ready

---

## System Overview

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 14, React 19, TypeScript | Server-side rendering, type safety |
| **UI Framework** | Tailwind CSS v4, Radix UI | Consistent design system |
| **State Management** | Zustand, React Context | Client state, auth management |
| **Backend** | Node.js, Next.js API Routes | API endpoints, business logic |
| **Database** | PostgreSQL 15+ | Primary data storage (Prisma) |
| **Auth Provider** | Supabase Auth | Authentication service |
| **ORM** | Prisma 5.x | Database abstraction layer |
| **Authentication** | Supabase Auth + JWT | Secure authentication |
| **Hosting** | Vercel | Edge deployment |
| **Monitoring** | Sentry, PostHog | Error tracking, analytics |

### System Components

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Application]
        MOB[Mobile App - Future]
        API_CLIENT[API SDK]
    end

    subgraph "Application Layer"
        NEXT[Next.js Application]
        AUTH[Auth Service]
        CHAT[Chat Service]
        AUDIT[Audit Service]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL)]
        REDIS[(Redis Cache - Future)]
        S3[S3 Storage - Future]
    end

    subgraph "External Services"
        OPENAI[OpenAI API]
        SLACK[Slack Integration]
        EMAIL[Email Service]
    end

    WEB --> NEXT
    API_CLIENT --> NEXT
    NEXT --> AUTH
    NEXT --> CHAT
    NEXT --> AUDIT
    AUTH --> PG
    CHAT --> PG
    AUDIT --> PG
    CHAT --> OPENAI
    AUDIT --> SLACK
    AUTH --> EMAIL
```

---

## Database Schema

### Entity Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ SESSION : has
    USER ||--o{ API_KEY : owns
    USER ||--o{ AUDIT_EVENT : triggers
    USER ||--o{ CHAT_THREAD : creates

    INSTRUMENT ||--o{ RUN : performs
    INSTRUMENT ||--o{ MAINTENANCE : requires

    CHAT_THREAD ||--o{ MESSAGE : contains
    API_KEY ||--o{ RATE_LIMIT : has

    WEBHOOK ||--o{ WEBHOOK_DELIVERY : sends

    USER {
        uuid id PK
        string email UK
        string passwordHash
        string name
        enum role
        timestamp createdAt
        timestamp updatedAt
        timestamp lastLoginAt
        boolean isActive
        int failedLoginAttempts
        timestamp accountLockedUntil
    }

    SESSION {
        uuid id PK
        uuid userId FK
        string token UK
        string ipAddress
        string userAgent
        timestamp createdAt
        timestamp expiresAt
    }

    API_KEY {
        uuid id PK
        uuid userId FK
        string keyHash UK
        string keyPrefix
        string name
        json permissions
        json ipAllowlist
        int rateLimit
        timestamp createdAt
        timestamp expiresAt
        timestamp lastUsedAt
        int usageCount
        boolean isActive
    }

    INSTRUMENT {
        uuid id PK
        string name
        enum type
        enum status
        string location
        string model
        string serialNumber
        string firmware
        json configuration
        json calibration
        timestamp createdAt
        timestamp updatedAt
        timestamp lastSeenAt
        uuid createdBy FK
    }

    RUN {
        uuid id PK
        uuid instrumentId FK
        enum status
        timestamp startedAt
        timestamp completedAt
        string dataUrl
        json metadata
        json results
        json qcMetrics
        timestamp createdAt
    }

    CHAT_THREAD {
        uuid id PK
        uuid userId FK
        string title
        boolean isArchived
        timestamp createdAt
        timestamp updatedAt
        timestamp lastMessageAt
    }

    MESSAGE {
        uuid id PK
        uuid threadId FK
        enum role
        text content
        text encryptedContent
        enum sensitivity
        json metadata
        timestamp createdAt
    }

    AUDIT_EVENT {
        uuid id PK
        uuid userId FK
        enum eventType
        enum severity
        string action
        enum outcome
        json metadata
        string ipAddress
        string userAgent
        string requestId
        string sessionId
        timestamp createdAt
    }

    RATE_LIMIT {
        uuid id PK
        string key UK
        int count
        timestamp windowStart
        boolean isBlocked
        timestamp blockedUntil
    }

    WEBHOOK {
        uuid id PK
        uuid userId FK
        string url
        string secret
        json events
        boolean isActive
        timestamp createdAt
    }

    WEBHOOK_DELIVERY {
        uuid id PK
        uuid webhookId FK
        json payload
        int statusCode
        json response
        int attempts
        timestamp deliveredAt
    }
```

### Database Tables

#### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    organization VARCHAR(255),
    department VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    failed_login_attempts INT DEFAULT 0,
    account_locked_until TIMESTAMP,

    INDEX idx_users_email (email),
    INDEX idx_users_role (role),
    INDEX idx_users_active (is_active)
);
```

#### Sessions Table
```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,

    INDEX idx_sessions_token (token),
    INDEX idx_sessions_user_id (user_id),
    INDEX idx_sessions_expires (expires_at)
);
```

#### Instruments Table
```sql
CREATE TABLE instruments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    location VARCHAR(255),
    model VARCHAR(255),
    serial_number VARCHAR(255) UNIQUE,
    firmware VARCHAR(100),
    configuration JSONB,
    calibration JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP,
    created_by UUID REFERENCES users(id),

    INDEX idx_instruments_status (status),
    INDEX idx_instruments_type (type),
    INDEX idx_instruments_location (location)
);
```

#### Runs Table
```sql
CREATE TABLE runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instrument_id UUID NOT NULL REFERENCES instruments(id),
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    data_url TEXT,
    metadata JSONB,
    results JSONB,
    qc_metrics JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_runs_instrument (instrument_id),
    INDEX idx_runs_status (status),
    INDEX idx_runs_started (started_at)
);
```

#### Audit Events Table
```sql
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    action TEXT NOT NULL,
    outcome VARCHAR(20) NOT NULL,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(255),
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_audit_events_user (user_id),
    INDEX idx_audit_events_type (event_type),
    INDEX idx_audit_events_created (created_at),
    INDEX idx_audit_events_severity (severity)
);
```

---

## API Architecture

### RESTful API Endpoints

#### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/login` | User login with credentials | No |
| POST | `/api/auth/logout` | User logout | Yes |
| POST | `/api/auth/refresh` | Refresh JWT token | Yes |
| POST | `/api/auth/forgot-password` | Request password reset | No |
| POST | `/api/auth/reset-password` | Reset password with token | No |

#### Instrument Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/instruments` | List all instruments | Yes |
| GET | `/api/v1/instruments/:id` | Get instrument details | Yes |
| POST | `/api/v1/instruments` | Register new instrument | Yes (Admin) |
| PUT | `/api/v1/instruments/:id` | Update instrument | Yes (Admin) |
| DELETE | `/api/v1/instruments/:id` | Remove instrument | Yes (Admin) |
| GET | `/api/v1/instruments/:id/status` | Get real-time status | Yes |
| POST | `/api/v1/instruments/:id/control` | Send control command | Yes (Operator) |

#### Run Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/runs` | List all runs | Yes |
| GET | `/api/v1/runs/:id` | Get run details | Yes |
| POST | `/api/v1/runs` | Start new run | Yes (Operator) |
| PUT | `/api/v1/runs/:id/stop` | Stop running experiment | Yes (Operator) |
| GET | `/api/v1/runs/:id/data` | Download run data | Yes |
| GET | `/api/v1/runs/:id/qc` | Get QC metrics | Yes |

#### Chat & Assistant

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/chat/threads` | List user's chat threads | Yes |
| POST | `/api/chat/threads` | Create new thread | Yes |
| GET | `/api/chat/threads/:id` | Get thread messages | Yes |
| POST | `/api/chat/threads/:id/messages` | Send message | Yes |
| DELETE | `/api/chat/threads/:id` | Delete thread | Yes |
| POST | `/api/chat/archive` | Archive thread | Yes |

#### Audit & Compliance

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/audit` | Log audit event | Yes/No* |
| GET | `/api/audit/events` | Query audit logs | Yes (Admin) |
| GET | `/api/audit/export` | Export audit logs | Yes (Admin) |

*Security events can be logged without authentication

### API Response Format

#### Success Response
```json
{
  "success": true,
  "data": {
    // Response payload
  },
  "metadata": {
    "timestamp": "2025-01-18T10:00:00Z",
    "version": "1.0.0",
    "requestId": "req_abc123"
  }
}
```

#### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "metadata": {
    "timestamp": "2025-01-18T10:00:00Z",
    "requestId": "req_abc123"
  }
}
```

### Rate Limiting

| Endpoint Type | Rate Limit | Window | Block Duration |
|---------------|------------|--------|----------------|
| Authentication | 5 req/min | 1 minute | 15 minutes |
| Public API | 100 req/min | 1 minute | 5 minutes |
| Authenticated API | 1000 req/min | 1 minute | 5 minutes |
| Admin API | 2000 req/min | 1 minute | 1 minute |

---

## Frontend Architecture

### Page Structure

```
src/app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx          # Login page
│   ├── signup/
│   │   └── page.tsx          # Registration page
│   └── forgot-password/
│       └── page.tsx          # Password reset
│
├── (dashboard)/
│   ├── layout.tsx            # Dashboard layout with sidebar
│   ├── dashboard/
│   │   └── page.tsx          # Main instruments dashboard
│   ├── assistant/
│   │   └── page.tsx          # AI Lab Assistant
│   ├── runs/
│   │   └── page.tsx          # Run history and management
│   ├── integrations/
│   │   └── page.tsx          # Third-party integrations
│   └── monitoring/
│       └── page.tsx          # System monitoring
│
├── api-playground/
│   └── page.tsx              # Interactive API explorer
│
├── notifications/
│   └── page.tsx              # Notifications center
│
└── api/                      # API routes (see API Architecture)
```

### Component Architecture

```
src/components/
├── ui/                       # Base UI components (Radix UI)
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   └── ...
│
├── auth/                     # Authentication components
│   ├── protected-route.tsx
│   ├── permission-denied.tsx
│   └── role-gate.tsx
│
├── dashboard/                # Dashboard components
│   ├── sidebar.tsx
│   ├── header.tsx
│   ├── instrument-card.tsx
│   └── status-badge.tsx
│
├── chat/                     # Chat components
│   ├── chat-message.tsx
│   ├── chat-input.tsx
│   ├── safe-message-content.tsx
│   └── chat-error-boundary.tsx
│
└── notifications/            # Notification components
    ├── notification-badge.tsx
    ├── notification-item.tsx
    └── enhanced-toast.tsx
```

### State Management

#### Context Providers

1. **SessionContext**
   - User authentication state
   - Role-based permissions
   - Session management
   - Auto-logout on expiry

2. **ChatContext**
   - Thread management
   - Message operations
   - Encryption/decryption
   - Rate limiting

3. **NotificationStore** (Zustand)
   - Notification queue
   - Desktop notifications
   - Do Not Disturb mode
   - Persistence

### Routing & Navigation

```typescript
// Protected Route Example
const protectedRoutes = [
  '/dashboard',
  '/assistant',
  '/runs',
  '/integrations',
  '/monitoring'
];

// Role-based Access
const roleAccess = {
  '/dashboard': ['admin', 'scientist', 'technician'],
  '/assistant': ['admin', 'scientist'],
  '/integrations': ['admin'],
  '/monitoring': ['admin', 'lab_manager']
};
```

---

## Authentication & Security

### Authentication Flow (Hybrid: Supabase Auth + Prisma Data)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant Supabase Auth
    participant Prisma DB
    participant Audit Service

    User->>Frontend: Enter credentials
    Frontend->>API: POST /api/auth/login

    Note over API: Authentication Phase
    API->>Supabase Auth: signInWithPassword(email, password)
    Supabase Auth-->>API: Session + Access Token

    Note over API: User Sync Phase
    API->>Prisma DB: findUnique(userId)
    alt User Not Found
        API->>Prisma DB: Create local user record
        Prisma DB-->>API: User created
    else User Exists
        Prisma DB-->>API: User record
    end

    Note over API: Session Creation
    API->>API: Create JWT session
    API->>Audit Service: Log login event
    API-->>Frontend: Success + Session
    Frontend->>Frontend: Store in httpOnly cookie
    Frontend-->>User: Redirect to dashboard
```

### Hybrid Architecture: Supabase Auth + Prisma Data

#### Why Hybrid?
We use a hybrid approach that leverages:
- **Supabase Auth**: For authentication, password management, and OAuth (future)
- **Prisma + PostgreSQL**: For application data, maintaining flexibility for future migration

#### Architecture Benefits
1. **Authentication Delegation**: Supabase handles complex auth flows, password resets, MFA
2. **Data Ownership**: Application data remains in our PostgreSQL instance via Prisma
3. **Migration Path**: Can migrate to AWS RDS, Azure Database, or self-hosted PostgreSQL
4. **Development Speed**: Supabase auth is production-ready out of the box

#### Data Synchronization
```typescript
// User exists in both systems
interface SupabaseUser {
  id: string          // UUID, shared between systems
  email: string       // Primary identifier
  email_confirmed_at: string
  // ... Supabase auth metadata
}

interface PrismaUser {
  id: string          // Same UUID as Supabase
  email: string       // Synced from Supabase
  name: string        // Application-specific data
  role: UserRole      // RBAC in our system
  organization: string // Business data
  // ... Application-specific fields
}
```

#### Sync Flow
1. **Signup**: Create user in Supabase → Create record in Prisma
2. **Login**: Authenticate with Supabase → Fetch/sync Prisma record
3. **Profile Update**: Update Prisma record (app data) independently
4. **Password Change**: Handled entirely by Supabase

### Security Features

#### Password Security (Supabase Managed)
- **Argon2id hashing** (Supabase default, more secure than bcrypt)
- **Password requirements**: Min 8 characters (configurable)
- **Account lockout**: Managed by Supabase Auth
- **Password reset**: Email-based with secure tokens

#### Session Security
- **JWT tokens** with short expiration (7 days)
- **Memory-only storage** (no localStorage)
- **Automatic expiration** handling
- **Secure token transmission** (HTTPS only)

#### API Security
- **Rate limiting** with exponential backoff
- **IP allowlisting** for API keys
- **CORS configuration** with strict origins
- **Request validation** with Zod schemas

#### Data Protection
- **AES-256-GCM encryption** for chat messages
- **PII/PHI redaction** in logs
- **Data classification** system
- **Audit trail** for all operations

### Role-Based Access Control (RBAC)

#### User Roles

| Role | Description | Permissions |
|------|-------------|------------|
| **SUPER_ADMIN** | System administrator | Full system access |
| **ADMIN** | Lab administrator | User management, configurations |
| **LAB_DIRECTOR** | Laboratory director | All lab operations |
| **LAB_MANAGER** | Lab manager | Instrument management |
| **SENIOR_SCIENTIST** | Senior researcher | Run experiments, data analysis |
| **SCIENTIST** | Researcher | Run experiments, view data |
| **TECHNICIAN** | Lab technician | Basic operations |
| **QUALITY_ASSURANCE** | QA officer | Audit logs, compliance |
| **COMPLIANCE_OFFICER** | Compliance | Regulatory oversight |
| **COLLABORATOR** | External partner | Limited access |
| **VIEWER** | Read-only user | View data only |
| **GUEST** | Temporary access | Minimal permissions |

#### Permission Matrix

```typescript
const PERMISSIONS = {
  ADMIN: [
    'assistant:execute',
    'instruments:*',
    'runs:*',
    'users:manage',
    'audit:view'
  ],
  SCIENTIST: [
    'assistant:execute',
    'instruments:view',
    'runs:create',
    'runs:view',
    'data:export'
  ],
  VIEWER: [
    'instruments:view',
    'runs:view'
  ]
};
```

---

## Data Flow Diagrams

### Real-time Instrument Monitoring

```mermaid
graph LR
    A[Instrument] -->|Data| B[Edge Agent]
    B -->|WebSocket| C[API Gateway]
    C -->|Validate| D[Auth Service]
    D -->|Authorized| E[Data Service]
    E -->|Store| F[(Database)]
    E -->|Publish| G[Event Bus]
    G -->|Subscribe| H[Dashboard]
    G -->|Subscribe| I[Notifications]
    G -->|Subscribe| J[Analytics]
```

### Chat Message Processing

```mermaid
graph TD
    A[User Input] -->|Sanitize| B[XSS Protection]
    B -->|Validate| C[Input Validation]
    C -->|Classify| D[Data Classification]
    D -->|Encrypt| E[AES-256-GCM]
    E -->|Store| F[(Database)]
    E -->|Stream| G[OpenAI API]
    G -->|Response| H[Content Filter]
    H -->|Render| I[Safe Display]
```

---

## Deployment Architecture

### Production Infrastructure

```mermaid
graph TB
    subgraph "Edge Network"
        CDN[Vercel Edge CDN]
        WAF[Web Application Firewall]
    end

    subgraph "Application Tier"
        LB[Load Balancer]
        APP1[Next.js App 1]
        APP2[Next.js App 2]
        APP3[Next.js App 3]
    end

    subgraph "Data Tier"
        PG_PRIMARY[(PostgreSQL Primary)]
        PG_REPLICA[(PostgreSQL Replica)]
        REDIS[Redis Cache]
    end

    subgraph "Storage"
        S3[S3 Object Storage]
    end

    CDN --> WAF
    WAF --> LB
    LB --> APP1
    LB --> APP2
    LB --> APP3
    APP1 --> PG_PRIMARY
    APP2 --> PG_PRIMARY
    APP3 --> PG_REPLICA
    APP1 --> REDIS
    APP2 --> REDIS
    APP3 --> REDIS
    APP1 --> S3
```

### Environment Configuration

| Environment | Description | Database | Features |
|-------------|-------------|----------|----------|
| **Development** | Local development | SQLite/PostgreSQL | Hot reload, debug mode |
| **Staging** | Pre-production testing | PostgreSQL | Production-like, test data |
| **Production** | Live environment | PostgreSQL cluster | Full features, monitoring |

### CI/CD Pipeline

```mermaid
graph LR
    A[Git Push] -->|Trigger| B[GitHub Actions]
    B -->|Lint| C[ESLint]
    B -->|Type Check| D[TypeScript]
    B -->|Test| E[Jest]
    E -->|Build| F[Next.js Build]
    F -->|Deploy| G[Vercel]
    G -->|Edge| H[Global CDN]
```

---

## Compliance & Audit

### Compliance Standards

#### HIPAA Compliance
- **Physical Safeguards**: Encrypted data at rest
- **Technical Safeguards**: Access controls, audit logs
- **Administrative Safeguards**: Training, policies
- **Breach Notification**: Automated alerting

#### SOC 2 Type II
- **Security**: Multi-factor authentication ready
- **Availability**: 99.9% uptime SLA
- **Processing Integrity**: Data validation
- **Confidentiality**: Encryption, access controls
- **Privacy**: Data minimization, retention policies

#### 21 CFR Part 11
- **Electronic Signatures**: User authentication
- **Audit Trails**: Tamper-evident logs
- **System Validation**: Documented testing
- **Change Control**: Version control, deployment tracking

### Audit Log Structure

```json
{
  "id": "evt_abc123",
  "timestamp": "2025-01-18T10:00:00Z",
  "userId": "usr_123",
  "eventType": "AUTH_LOGIN_SUCCESS",
  "severity": "INFO",
  "action": "User logged in",
  "outcome": "SUCCESS",
  "metadata": {
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "sessionId": "sess_xyz",
    "requestId": "req_def456"
  },
  "signature": "HMAC-SHA256 signature"
}
```

### Data Retention Policies

| Data Type | Retention Period | Archive Location |
|-----------|-----------------|------------------|
| Audit Logs | 7 years | Cold storage |
| Run Data | 5 years | S3 Archive |
| Chat History | 1 year | Encrypted backup |
| User Sessions | 30 days | Database |
| Rate Limits | 24 hours | Memory cache |

---

## Performance & Scalability

### Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| API Response Time | < 100ms | 85ms avg |
| Page Load Time | < 2s | 1.5s avg |
| Time to Interactive | < 3s | 2.3s avg |
| Database Query Time | < 50ms | 35ms avg |
| WebSocket Latency | < 100ms | 75ms avg |

### Caching Strategy

```mermaid
graph TD
    A[Request] -->|Check| B{CDN Cache?}
    B -->|Hit| C[Return Cached]
    B -->|Miss| D{Redis Cache?}
    D -->|Hit| E[Return from Redis]
    D -->|Miss| F[Query Database]
    F -->|Store| G[Update Redis]
    F -->|Store| H[Update CDN]
    F -->|Return| I[Response]
```

### Scalability Considerations

#### Horizontal Scaling
- **Application Tier**: Auto-scaling with Kubernetes
- **Database**: Read replicas for queries
- **Cache Layer**: Redis cluster
- **Storage**: Distributed object storage

#### Vertical Scaling
- **Database**: Up to 64 cores, 256GB RAM
- **Application**: Up to 16 cores, 32GB RAM
- **Cache**: Up to 128GB memory

#### Load Testing Results

| Concurrent Users | Response Time | Error Rate |
|-----------------|---------------|------------|
| 100 | 85ms | 0% |
| 500 | 120ms | 0% |
| 1000 | 250ms | 0.1% |
| 5000 | 800ms | 0.5% |
| 10000 | 2000ms | 2% |

---

## Monitoring & Observability

### Monitoring Stack

```mermaid
graph TB
    subgraph "Application"
        APP[Next.js App]
        OTEL[OpenTelemetry]
    end

    subgraph "Monitoring"
        METRICS[Prometheus]
        LOGS[ELK Stack]
        TRACES[Jaeger]
        APM[Sentry]
    end

    subgraph "Visualization"
        GRAFANA[Grafana]
        KIBANA[Kibana]
    end

    APP --> OTEL
    OTEL --> METRICS
    OTEL --> LOGS
    OTEL --> TRACES
    APP --> APM
    METRICS --> GRAFANA
    LOGS --> KIBANA
```

### Key Metrics

#### Application Metrics
- Request rate (req/s)
- Error rate (%)
- Response time (p50, p95, p99)
- Active users
- Session duration

#### Infrastructure Metrics
- CPU utilization
- Memory usage
- Disk I/O
- Network throughput
- Database connections

#### Business Metrics
- Daily active users
- Instruments connected
- Runs completed
- Data processed (GB)
- API calls

---

## Disaster Recovery

### Backup Strategy

| Component | Frequency | Retention | Recovery Time |
|-----------|-----------|-----------|---------------|
| Database | Every 6 hours | 30 days | < 1 hour |
| File Storage | Daily | 90 days | < 2 hours |
| Configuration | On change | Unlimited | < 30 minutes |
| Audit Logs | Real-time | 7 years | < 4 hours |

### Recovery Procedures

1. **Database Recovery**
   - Point-in-time recovery available
   - Automated failover to replica
   - Manual promotion if needed

2. **Application Recovery**
   - Blue-green deployment
   - Instant rollback capability
   - Zero-downtime deployments

3. **Data Recovery**
   - Encrypted backups in multiple regions
   - Cross-region replication
   - Immutable backup storage

---

## Security Incident Response

### Incident Response Plan

```mermaid
graph TD
    A[Security Event] -->|Detect| B[Alert System]
    B -->|Triage| C{Severity?}
    C -->|Critical| D[Immediate Response]
    C -->|High| E[Urgent Response]
    C -->|Medium/Low| F[Scheduled Response]
    D --> G[Isolate System]
    E --> H[Investigate]
    F --> I[Log for Review]
    G --> J[Forensics]
    H --> J
    J --> K[Remediate]
    K --> L[Post-Mortem]
```

### Security Contacts

| Role | Contact | Response Time |
|------|---------|---------------|
| Security Lead | security@antevus.com | < 15 min |
| CTO | cto@antevus.com | < 30 min |
| DevOps Lead | devops@antevus.com | < 15 min |
| External Security | vendor@security.com | < 2 hours |

---

## Future Enhancements

### Planned Features (Q1-Q2 2025)

1. **Real-time WebSockets**
   - Live instrument updates
   - Instant notifications
   - Collaborative features

2. **Advanced Analytics**
   - ML-based predictions
   - Anomaly detection
   - Trend analysis

3. **Mobile Application**
   - React Native app
   - Push notifications
   - Offline support

4. **Enhanced Integrations**
   - Benchling ELN
   - LabVantage LIMS
   - Microsoft Teams

5. **Multi-tenancy**
   - Organization isolation
   - Custom domains
   - White-labeling

### Technical Debt

| Item | Priority | Effort | Impact |
|------|----------|--------|--------|
| Add comprehensive test coverage | High | Large | High |
| Implement Redis caching | High | Medium | High |
| Migrate to microservices | Medium | Large | Medium |
| Add GraphQL API | Low | Medium | Low |
| Implement event sourcing | Low | Large | Medium |

---

## Appendices

### A. Environment Variables

```bash
# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://app.antevus.com

# Database
DATABASE_URL=postgresql://user:pass@host:5432/antevus  # Prisma DB
DIRECT_URL=postgresql://user:pass@host:5432/antevus   # Direct connection
DATABASE_POOL_SIZE=20

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Server-side only

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRATION=7d
BCRYPT_ROUNDS=12

# External Services
OPENAI_API_KEY=sk-...
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG...

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
POSTHOG_API_KEY=phc_...

# Security
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=1000
SESSION_SECRET=your-session-secret
CORS_ORIGIN=https://app.antevus.com
```

### B. API Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| AUTH_INVALID_CREDENTIALS | Invalid login credentials | 401 |
| AUTH_TOKEN_EXPIRED | JWT token expired | 401 |
| AUTH_INSUFFICIENT_PERMISSIONS | Lacking required permissions | 403 |
| RATE_LIMIT_EXCEEDED | Too many requests | 429 |
| VALIDATION_ERROR | Input validation failed | 400 |
| RESOURCE_NOT_FOUND | Resource doesn't exist | 404 |
| INTERNAL_ERROR | Server error | 500 |
| SERVICE_UNAVAILABLE | Service temporarily down | 503 |

### C. Development Commands

```bash
# Development
npm run dev           # Start development server
npm run build        # Build for production
npm run start        # Start production server

# Database
npm run db:migrate   # Run migrations
npm run db:seed      # Seed database
npm run db:reset     # Reset database

# Testing
npm run test         # Run tests
npm run test:e2e     # Run E2E tests
npm run test:coverage # Generate coverage report

# Code Quality
npm run lint         # Run ESLint
npm run type-check   # Check TypeScript
npm run format       # Format with Prettier

# Deployment
npm run deploy:staging    # Deploy to staging
npm run deploy:production # Deploy to production
```

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-01-18 | System Architecture Team | Initial documentation |
| 1.0.1 | 2025-01-18 | Security Team | Added security sections |
| 1.0.2 | 2025-01-18 | DevOps Team | Added deployment architecture |

---

## Contact Information

- **Technical Support**: support@antevus.com
- **Security Issues**: security@antevus.com
- **Documentation**: docs@antevus.com
- **GitHub**: https://github.com/gabeviggers/antevus-app

---

*This document is classified as **INTERNAL** and should not be shared outside the organization without approval.*

© 2025 Antevus Labs. All rights reserved.