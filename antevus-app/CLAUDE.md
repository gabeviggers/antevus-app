# Antevus - Universal Laboratory Instrument API Platform

## Current Status
**Phase 0 Complete** - Foundation and infrastructure setup completed (Dec 11, 2024)
- Next.js 14 app with TypeScript running at http://localhost:3000
- All core development tools configured and ready
- Ready to begin Phase 1: Demo-Ready Frontend MVP

## Product Vision
**The Plaid for Labs** - A developer-friendly connectivity layer for laboratory instruments that eliminates integration overhead and enables faster experiments through a unified API.

## Problem We're Solving

### Current Laboratory Pain Points
- **Instrument Data Silos**: Labs rely on USB sticks, CSV exports, or vendor-specific GUIs to move data between instruments
- **No Standard API**: Every integration is a one-off custom project requiring specific drivers and parsers
- **Poor Developer Experience**: Lab automation engineers spend more time on plumbing than science
- **Limited Visibility**: No single pane of glass view across all instruments' status and outputs
- **Compliance Burden**: GMP labs need audit trails, role-based access, and signed records handled manually across systems

## Core Solution

Antevus provides a universal connectivity and data normalization layer for laboratory instruments:

1. **Connect**: Lightweight agent discovers and connects instruments automatically
2. **Normalize**: All output converted into single structured schema (JSON/CSV)
3. **Expose**: Secure API, SDK, and event system for building automations and pipelines
4. **Control**: (Phase 2) Orchestrate and schedule runs programmatically with compliance-grade audit logs

## Target Users & Personas

- **Lab Automation Engineer**: Needs single SDK to orchestrate all devices
- **Scientist/Researcher**: Wants quick access to run results and QC status
- **Lab Manager**: Needs real-time visibility into instrument usage and metrics
- **Compliance/QA Officer**: Requires full audit trails and GMP-friendly logs

## Complete Feature Set

### Connectivity Layer
- Local edge agent (Docker/installer) for secure on-prem to cloud bridging
- Auto-discovery of instruments with zero manual configuration
- Pluggable device connectors (Opentrons, Illumina, Tecan, Agilent, Hamilton)
- Offline buffer + sync for air-gapped labs or network downtime

### Data Layer
- Universal data normalization schema for multi-device analysis
- Metadata enrichment (timestamp, user, project)
- Historical storage for audit and analytics
- Versioned raw data storage in object storage (S3/GCS)

### API & SDK
- REST API + WebSockets for real-time events
- OAuth2 authentication for third-party apps
- Python SDK (`pip install antevus`) + CLI tools
- Webhook subscriptions for event-driven architectures
- HMAC-signed webhooks for security

### Dashboard & UI
- Instrument grid with real-time status (Running/Idle/Error)
- Searchable run log with data preview
- Real-time QC and monitoring charts
- One-click integrations (ELN/LIMS/Slack)
- Audit logs with compliance-ready exports (PDF/CSV)

### Control Layer (Phase 2)
- Remote start/stop run capabilities
- Scheduling and queuing for maximized utilization
- Role-based e-signatures for FDA 21 CFR Part 11 compliance

## Technical Architecture

### Backend Stack

#### Core Services
- **Language/Runtime**: Python (FastAPI) or Go (Fiber)
- **Framework**: FastAPI + Pydantic models for type-safe, async APIs
- **Containerization**: Docker + Kubernetes (EKS/GKE/AKS)
- **API Gateway**: Kong or AWS API Gateway for rate limiting, JWT verification

#### Data & Storage
- **Primary Database**: PostgreSQL with TimescaleDB for time-series telemetry
- **Message Bus**: Apache Kafka or AWS MSK for durable event streams
- **Object Storage**: S3 or GCS for raw CSV/FASTQ outputs
- **Cache Layer**: Redis for session management and real-time data

#### Security & Compliance
- **Auth & RBAC**: Auth0 or Keycloak for OAuth2, SAML/SSO
- **Secrets Management**: HashiCorp Vault or AWS KMS
- **Compliance Logging**: Immutable WORM storage for 21 CFR Part 11
- **Zero-Trust Networking**: Mutual TLS between edge agents and API

#### Observability
- **Metrics**: OpenTelemetry + Prometheus + Grafana
- **Distributed Tracing**: Jaeger or AWS X-Ray
- **Log Aggregation**: ELK Stack or CloudWatch

### Edge Gateway Architecture
- **Runtime**: Go or Rust agent for safety and cross-platform support
- **Deployment**: Auto-updating installers (MSI/PKG) for non-technical staff
- **Core Functions**:
  - Instrument discovery and protocol handling
  - Data normalization and buffering
  - TLS streaming with automatic reconnection
  - Local caching for offline operation

### Frontend Architecture

#### Technology Stack
- **Framework**: React + Next.js for SSR and optimal performance
- **UI Library**: Tailwind CSS + Radix UI for consistent, accessible components
- **Charts**: Recharts or Apache ECharts for telemetry visualization
- **State Management**: React Query or Zustand for async API calls
- **Real-Time**: WebSockets (Socket.IO) or Server-Sent Events
- **Build & Deploy**: Vercel or containerized CI/CD pipeline

#### UX Principles
- Single pane of glass grid view with color-coded states
- Developer playground with interactive API explorer
- Dark mode support for lab environments
- Offline-friendly with local caching
- Responsive design for lab PCs and tablets

## API Design

### Core Endpoints
```
GET  /instruments         � List instruments + status
GET  /runs               � List past runs (filterable)
GET  /runs/{id}/data     � Download normalized result
POST /webhooks           � Subscribe to run events
POST /control/start      � (Phase 2) Start run remotely
```

### Developer Experience
- Stripe-like API documentation with live console
- Strongly typed JSON responses with versioning
- Mock data environment for testing
- Comprehensive SDKs starting with Python

## Security Architecture

### Authentication & Authorization
- OAuth2 for third-party applications
- API keys for service-to-service communication
- JWT tokens with short expiration
- Role-based and attribute-based access controls (RBAC/ABAC)

### Data Protection
- End-to-end encryption for data in transit
- AES-256 encryption for data at rest
- Signed container images
- Static analysis and dependency scanning in CI/CD

### Compliance
- SOC 2 Type II ready
- ISO 27001 compliant architecture
- GxP/21 CFR Part 11 audit trails
- GDPR-compliant data handling

## User Journeys

### Scientist Workflow
1. Instrument powers up � Edge Agent auto-detects
2. Run starts � Event logged, visible in dashboard
3. Real-time charts update during run
4. Run completes � Slack notification with results link
5. One-click export to Benchling/ELN

### Developer Integration
1. Install SDK: `pip install antevus`
2. Authenticate with API key
3. Subscribe to webhooks for run events
4. Build custom dashboards using normalized data
5. Trigger downstream analysis pipelines automatically

## Success Metrics

- **Adoption**: Number of connected instruments per customer
- **Engagement**: Daily active users, API call volume
- **Time Saved**: >50% reduction in manual data transfer time
- **Retention**: e90% renewal rate after 6-month pilot

## Implementation Roadmap

### Phase 1: Core Platform (Months 1-3)
- Edge agent with top 5 instrument connectors
- Basic dashboard with instrument status
- REST API with Python SDK
- Data normalization and storage

### Phase 2: Advanced Features (Months 4-6)
- Real-time streaming and webhooks
- Integration marketplace (ELN/LIMS)
- Advanced analytics and QC dashboards
- Compliance features (audit logs, e-signatures)

### Phase 3: Control & Orchestration (Months 7-9)
- Remote instrument control
- Workflow orchestration engine
- Scheduling and resource optimization
- AI-driven experiment suggestions

## Development Guidelines

### Code Quality
- Type-safe code with comprehensive testing (>80% coverage)
- Automated CI/CD with staging environments
- Code review required for all PRs
- Security scanning on every commit

### API Versioning
- Semantic versioning for all APIs
- Backward compatibility for 2 major versions
- Deprecation notices 6 months in advance
- Clear migration guides for breaking changes

### Documentation
- API documentation auto-generated from OpenAPI specs
- Comprehensive SDK examples and tutorials
- Video walkthroughs for common integrations
- Regular updates to reflect new features

## Development Setup

### Quick Start
```bash
npm install
npm run dev  # Runs at http://localhost:3000
```

### Tech Stack (Current)
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS v3, Radix UI
- **Database**: PostgreSQL, Redis, TimescaleDB (via Docker)
- **DevOps**: Vercel, GitHub Actions, Sentry, PostHog
- **Code Quality**: ESLint, Prettier, Husky

### Documentation
- **Setup Guide**: See SETUP_GUIDE.md for detailed instructions
- **Roadmap**: See IMPLEMENTATION_ROADMAP.md for development phases
- **Project Context**: This file (CLAUDE.md)

## Contact & Support

- **GitHub**: github.com/gabeviggers/antevus
- **Email**: gabeviggers@gmail.com
- **Documentation**: docs.antevus.com
- **API Status**: status.antevus.com (coming soon)