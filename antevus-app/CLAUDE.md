# Antevus - Universal Laboratory Instrument API Platform

## Current Status
**Phase 1.5 In Progress** - Lab Assistant Backend Implementation (December 19, 2024)
- Next.js 14 app with TypeScript running at http://localhost:3000
- All core development tools configured and ready
- Full dashboard with instruments, monitoring, runs, integrations, API playground
- **Lab Assistant Frontend**: Complete with UI, state management, and security ✅
- **Lab Assistant Backend**: In development - LLM integration and real-time streaming 🚧
- **Pricing & Packaging**: Comprehensive pricing model defined and documented ✅
- **Security & Compliance**: Enterprise-grade implementation - HIPAA/SOC 2 compliant ✅

### Critical Security Implementation (December 2024) ✅
- **Complete removal of localStorage PII vulnerabilities** - Zero client-side sensitive data storage
- **Server-side session management** - JWT with httpOnly cookies, no client-side tokens
- **Encrypted data at rest** - AES-256-GCM encryption for all sensitive onboarding data
- **No authentication bypasses** - All hardcoded emails removed, demo mode via environment variables
- **Comprehensive audit logging** - Every sensitive action tracked with severity levels
- **Production-ready security headers** - HIPAA/SOC 2 compliant CSP, HSTS, X-Frame-Options

### Lab Assistant Implementation Status
- **Frontend (100% Complete)**: Chat UI, thread management, streaming simulation, security
- **Backend (20% Complete)**: Thread storage API done, LLM integration in progress
- **Next Priority**: OpenAI API integration and streaming endpoints

### Pricing Model Status
- **Pricing Strategy**: Instrument-based tiers with usage meters ✅
- **Commercial Tiers**: Core ($1,500/mo), Team ($4,000/mo), Scale ($7,500/mo), Enterprise ✅
- **Academic Program**: 40% discount for eligible institutions ✅
- **Documentation**: Complete pricing guide and implementation roadmap ✅

## Product Vision
**The Plaid for Labs** - A developer-friendly connectivity layer for laboratory instruments that eliminates integration overhead and enables faster experiments through a unified API. Now with natural language control - lab workers can command their instruments through conversational AI, making complex operations as simple as asking a question.

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

### Natural Language Lab Control (NEW)
- **Conversational Interface**: Chat-based control of lab instruments with natural language
- **Smart Queries**: "What's running?", "Show failed runs for Project A", "Summarize today's HPLC results"
- **Guard-railed Actions**: Start/pause/stop runs with policy-enforced safety checks
- **Compliance-Ready**: CFR Part 11 e-signatures, audit trails, and change control
- **Multi-step Orchestration**: Complex workflows executed through simple commands
- **Real-time Updates**: Live streaming of run status and results in chat

### Control Layer (Phase 2)
- Remote start/stop run capabilities
- Scheduling and queuing for maximized utilization
- Role-based e-signatures for FDA 21 CFR Part 11 compliance
- Natural language orchestration with policy enforcement
- Dry-run previews before execution
- Automated safety interlocks and dependency checks

## Technical Architecture

### Backend Stack

#### Core Services
- **Language/Runtime**: Python (FastAPI) or Go (Fiber)
- **Framework**: FastAPI + Pydantic models for type-safe, async APIs
- **Containerization**: Docker + Kubernetes (EKS/GKE/AKS)
- **API Gateway**: Kong or AWS API Gateway for rate limiting, JWT verification

#### Data & Storage
- **Primary Database**: PostgreSQL with TimescaleDB for time-series telemetry
- **Vector Database**: pgvector/Weaviate for semantic search over lab data
- **Message Bus**: Apache Kafka or AWS MSK for durable event streams
- **Object Storage**: S3 or GCS for raw CSV/FASTQ outputs
- **Cache Layer**: Redis for session management and real-time data

#### Security & Compliance
- **Auth & RBAC**: Auth0 or Keycloak for OAuth2, SAML/SSO
- **Policy Engine**: OPA (Open Policy Agent) for fine-grained ABAC controls
- **Secrets Management**: HashiCorp Vault or AWS KMS
- **Compliance Logging**: Immutable WORM storage for 21 CFR Part 11
- **Zero-Trust Networking**: Mutual TLS between edge agents and API
- **Intent Validation**: Typed schemas and whitelist for all NL actions

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
- **Chat Interface**: Streaming responses with markdown rendering
- **Build & Deploy**: Vercel or containerized CI/CD pipeline

#### Natural Language Components
- **LLM Integration**: OpenAI API with function calling for intent parsing
- **RAG Pipeline**: Retrieval-augmented generation for contextual answers
- **Tool Registry**: Typed function definitions for available actions
- **Policy Renderer**: Visual representation of permission checks

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

# Natural Language Endpoints
WS   /lab-assistant/chat � WebSocket for streaming chat
POST /lab-assistant/intent � Parse and validate user intent
POST /lab-assistant/execute � Execute validated action
GET  /lab-assistant/capabilities � Get available actions per role
```

### Developer Experience
- Stripe-like API documentation with live console
- Strongly typed JSON responses with versioning
- Mock data environment for testing
- Comprehensive SDKs starting with Python

## Security Architecture (Production Ready ✅)

### Authentication & Authorization
- **JWT-based sessions** with httpOnly secure cookies (no localStorage/sessionStorage)
- **Server-side session validation** via `/lib/security/session-helper.ts`
- **No client-side authentication bypasses** - all validation server-side
- **Demo mode** controlled by environment variables, not client code
- **Role-based access control (RBAC)** with comprehensive authorization service
- **API key management** with secure generation and validation

### Data Protection
- **AES-256-GCM encryption** for all PII at rest
- **Zero client-side PII storage** - no localStorage/sessionStorage/cookies with PII
- **Encrypted onboarding data** in PostgreSQL with `OnboardingProgress` model
- **TLS 1.3** for data in transit
- **Secure headers** enforced via middleware (CSP, HSTS, X-Frame-Options)
- **Input sanitization** with Zod schemas on all endpoints

### Compliance & Audit
- **HIPAA Compliant** - No unencrypted PII in browser storage (164.312 compliant)
- **SOC 2 Type II ready** - Comprehensive audit logging with severity levels
- **21 CFR Part 11** - Complete audit trails with tamper-proof logging
- **GDPR compliant** - Data encryption, right to deletion, audit trails
- **Rate limiting** on all sensitive endpoints (configurable per route)
- **Security event tracking** with automatic alerting for suspicious activity

## User Journeys

### Scientist Workflow
1. Instrument powers up � Edge Agent auto-detects
2. Run starts � Event logged, visible in dashboard
3. Real-time charts update during run
4. Run completes � Slack notification with results link
5. One-click export to Benchling/ELN

### Natural Language Workflow
1. Scientist asks: "What's the status of my qPCR runs?"
2. Assistant queries data and returns formatted table with links
3. Scientist: "Start ELISA protocol on plate reader PR-07"
4. Assistant shows dry-run plan with parameters
5. Scientist confirms with e-signature
6. Assistant streams execution logs and notifies on completion

### Developer Integration
1. Install SDK: `pip install antevus`
2. Authenticate with API key
3. Subscribe to webhooks for run events
4. Build custom dashboards using normalized data
5. Trigger downstream analysis pipelines automatically

## Pricing & Business Model

### Pricing Philosophy
- **Instrument-based tiers** aligned with lab operations (not seats)
- **Modern usage meters** for events/streams, AI tokens, and storage
- **Academic program** with 40% discount + university bundles
- **Clear upgrade paths** with transparent overages

### Commercial Tiers
- **Core**: $1,500/month (up to 10 instruments, 1M events, 200k AI tokens)
- **Team**: $4,000/month (up to 25 instruments, 3M events, 750k AI tokens)
- **Scale**: $7,500/month (up to 50 instruments, 8M events, 2M AI tokens)
- **Enterprise**: $250k-$500k/year (unlimited, 50M+ events, 10M+ tokens, 99.99% SLA)

### Academic Program
- **40% discount** on Core/Team/Scale tiers
- **Core Facility Pack**: $2,400/month (25 instruments with iLab/PPMS integration)
- **Campus Pilot**: $15k for 90 days (15 instruments)
- **Teaching Lab License**: $250/month (2 instruments, unlimited students)

### Add-Ons & Options
- **Compliance Pack**: $1,500/month (21 CFR Part 11, e-signatures, WORM)
- **Premium Connectors**: $200-500/month (Illumina, Agilent, Tecan, Hamilton)
- **BYO-LLM**: Available on all tiers (no AI markup)
- **Single-tenant isolation**: +$1,000/month (Team tier+)

## Success Metrics

- **Adoption**: Number of connected instruments per customer
- **Engagement**: Daily active users, API call volume
- **Time Saved**: >50% reduction in manual data transfer time
- **Retention**: >90% renewal rate after 6-month pilot
- **Revenue Growth**: MRR, net revenue retention, LTV:CAC ratio
- **ROI**: 7-12x documented savings for typical deployments

## Implementation Roadmap

### Phase 1: Core Platform ✅ COMPLETE
- Edge agent with top 5 instrument connectors
- Basic dashboard with instrument status
- REST API with Python SDK
- Data normalization and storage

### Phase 1.5: Lab Assistant Backend 🚧 IN PROGRESS (Current Focus)
**Timeline**: 6 weeks starting Dec 17, 2024

#### Week 1-2: Core LLM Infrastructure
- OpenAI GPT-4o integration
- Server-Sent Events for streaming
- Message processing pipeline
- Context management system

#### Week 2-3: Function Calling & Integration
- Tool registry for instrument control
- Query engine for data retrieval
- Mock instrument data integration
- Result formatting and presentation

#### Week 3-4: Safety & Compliance
- Policy engine with OPA
- Intent classification system
- E-signature implementation
- Audit trail enhancement

#### Week 4-5: Advanced Features
- Vector search with pgvector
- Report generation (PDF/CSV)
- Notification services (Slack/Email)
- Template system

#### Week 5-6: Production Readiness
- Performance optimization
- Comprehensive testing
- Monitoring and observability
- Documentation and deployment

### Phase 2: Advanced Features (After Lab Assistant)
- Real-time streaming and webhooks
- Integration marketplace (ELN/LIMS)
- Advanced analytics and QC dashboards
- Enhanced compliance features

### Phase 3: Control & Orchestration
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
- **Natural Language Control**: See NL_LAB_CONTROL.md for technical specification
- **Pricing & Packaging**: See PRICING.md for complete pricing model and implementation
- **Project Context**: This file (CLAUDE.md)

## Contact & Support

- **GitHub**: github.com/gabeviggers/antevus
- **Email**: gabeviggers@gmail.com
- **Documentation**: docs.antevus.com
- **API Status**: status.antevus.com (coming soon)