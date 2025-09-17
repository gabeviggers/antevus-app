# Lab Assistant Backend Implementation Plan

## Executive Summary

The Lab Assistant frontend is 100% complete with full UI, thread management, and security features. However, the entire backend infrastructure for LLM integration, real-time streaming, and function calling is missing. This document outlines the comprehensive plan to build the backend services needed to power the Lab Assistant with real AI capabilities.

## Current State Analysis

### What's Complete ✅
- **Frontend UI**: Full chat interface with streaming simulation
- **Thread Management**: Create, rename, delete, search threads
- **Security Layer**: XSS protection, RBAC, audit logging
- **Storage API**: Encrypted thread storage at `/api/chat/threads`
- **Session Context**: Secure client-side state management
- **Data Classification**: PHI/PII detection and redaction

### What's Missing ❌
- **LLM Integration**: No OpenAI/Claude API connection
- **Streaming Infrastructure**: No real SSE/WebSocket implementation
- **Chat Completion API**: No endpoint to process messages
- **Function Calling**: No tool registry or execution engine
- **Data Integration**: No connection to instrument/run data
- **Policy Engine**: No command validation or safety checks
- **Vector Search**: No semantic search capabilities
- **Report Generation**: No PDF/CSV export functionality
- **Notifications**: No Slack/email integration

## Implementation Timeline

### Week 1-2: Core LLM Infrastructure
**Goal**: Establish basic chat functionality with real AI

#### Tasks
1. **OpenAI Setup** (Day 1-2)
   ```bash
   npm install openai
   npm install eventsource-parser
   npm install p-queue  # For rate limiting
   ```
   - Configure API keys and environment variables
   - Set up provider abstraction layer
   - Implement error handling and retries

2. **Chat Completion API** (Day 3-4)
   ```typescript
   // /app/api/chat/completion/route.ts
   - Message processing pipeline
   - Context window management
   - Token counting and limits
   - Response formatting
   ```

3. **Streaming Implementation** (Day 5-7)
   ```typescript
   // /app/api/chat/stream/route.ts
   - Server-Sent Events setup
   - Stream parsing and chunking
   - Error recovery in streams
   - Connection management
   ```

4. **Frontend Integration** (Day 8-10)
   - Replace mock responses with API calls
   - Implement SSE client
   - Add error boundaries
   - Update loading states

#### Deliverables
- Working chat with GPT-4o
- Real-time streaming responses
- Basic error handling
- Connected to existing thread storage

### Week 2-3: Function Calling & Data Integration
**Goal**: Enable instrument queries and control

#### Tasks
1. **Tool Registry System** (Day 1-3)
   ```typescript
   // /lib/tools/registry.ts
   interface Tool {
     name: string
     description: string
     parameters: JSONSchema
     handler: (params: any) => Promise<any>
     requiresAuth: boolean
     permissions: Permission[]
   }
   ```

2. **Instrument Functions** (Day 4-6)
   ```typescript
   // /lib/tools/instruments.ts
   - getInstrumentStatus()
   - getRunHistory()
   - startRun()
   - stopRun()
   - getProtocols()
   ```

3. **Query Engine** (Day 7-9)
   ```typescript
   // /lib/tools/queries.ts
   - Natural language to SQL
   - Result formatting
   - Pagination support
   - Aggregation functions
   ```

4. **Integration Testing** (Day 10)
   - End-to-end function calling
   - Mock data validation
   - Error scenario testing

#### Deliverables
- Function calling with OpenAI
- Mock instrument data integration
- Query capabilities
- Formatted responses with tables/charts

### Week 3-4: Safety & Compliance
**Goal**: Add security and compliance layers

#### Tasks
1. **Policy Engine** (Day 1-4)
   ```typescript
   // /lib/policy/engine.ts
   - Command validation rules
   - Permission checking
   - Risk assessment
   - Dry-run previews
   ```

2. **Intent Classification** (Day 5-7)
   ```typescript
   // /lib/nlp/intent.ts
   - Action classification
   - Confidence scoring
   - Confirmation requirements
   - Multi-step workflows
   ```

3. **Compliance Features** (Day 8-10)
   ```typescript
   // /lib/compliance/audit.ts
   - E-signature capture
   - 21 CFR Part 11 logs
   - Immutable records
   - Retention policies
   ```

#### Deliverables
- Policy-enforced command execution
- Confirmation dialogs for actions
- Complete audit trail
- Compliance reports

### Week 4-5: Advanced Features
**Goal**: Enhanced capabilities

#### Tasks
1. **Vector Search** (Day 1-3)
   ```typescript
   // /lib/embeddings/service.ts
   - Document chunking
   - Embedding generation
   - Similarity search
   - RAG implementation
   ```

2. **Report Generation** (Day 4-6)
   ```typescript
   // /lib/reports/generator.ts
   - PDF generation
   - CSV export
   - Template engine
   - Scheduled reports
   ```

3. **Notifications** (Day 7-10)
   ```typescript
   // /lib/notifications/service.ts
   - Slack webhooks
   - Email service
   - Real-time alerts
   - Delivery tracking
   ```

#### Deliverables
- Semantic search over lab data
- Report generation and export
- Multi-channel notifications
- Template system

### Week 5-6: Production Readiness
**Goal**: Optimization and deployment

#### Tasks
1. **Performance** (Day 1-3)
   - Response caching
   - Query optimization
   - Token usage reduction
   - CDN setup

2. **Testing** (Day 4-7)
   - Unit tests (>80% coverage)
   - Integration tests
   - Load testing
   - Security testing

3. **Monitoring** (Day 8-10)
   - Prometheus metrics
   - Grafana dashboards
   - Alert rules
   - Error tracking

#### Deliverables
- Optimized performance
- Comprehensive test suite
- Production monitoring
- Deployment documentation

## Technical Architecture

### API Structure
```
/app/api/chat/
├── completion/route.ts    # Main chat endpoint
├── stream/route.ts        # SSE streaming
├── threads/route.ts       # Thread management (existing)
├── tools/route.ts         # Function execution
├── feedback/route.ts      # User feedback
└── export/route.ts        # Export conversations
```

### Service Layer
```
/lib/services/
├── llm/
│   ├── openai.ts         # OpenAI provider
│   ├── anthropic.ts      # Claude provider
│   └── provider.ts       # Provider interface
├── tools/
│   ├── registry.ts       # Tool registration
│   ├── instruments.ts    # Instrument functions
│   └── queries.ts        # Query functions
├── policy/
│   ├── engine.ts         # Policy evaluation
│   └── rules.ts          # Policy definitions
└── streaming/
    ├── sse.ts           # SSE implementation
    └── parser.ts        # Stream parsing
```

### Database Schema
```sql
-- Function calls table
CREATE TABLE function_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES chat_messages(id),
    function_name VARCHAR(100) NOT NULL,
    parameters JSONB,
    result JSONB,
    error TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Policy decisions table
CREATE TABLE policy_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    function_call_id UUID REFERENCES function_calls(id),
    decision VARCHAR(20) CHECK (decision IN ('allow', 'deny', 'confirm')),
    reason TEXT,
    risk_score FLOAT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Security Considerations

### API Security
- **Rate Limiting**: 60 requests/min per user
- **Token Limits**: 100k tokens/hour per user
- **Input Validation**: Sanitize all user inputs
- **Output Filtering**: Redact sensitive data

### LLM Security
- **Prompt Injection Protection**: Input validation and output filtering
- **System Prompt Protection**: Never expose system prompts
- **Function Call Validation**: Whitelist allowed functions
- **Data Access Control**: Filter data based on user permissions

### Compliance Requirements
- **HIPAA**: Encrypt PHI in transit and at rest
- **SOC 2**: Complete audit logging
- **21 CFR Part 11**: E-signatures and immutable records
- **GDPR**: Data retention and deletion policies

## Development Priorities

### Must Have (MVP)
1. Basic chat with OpenAI
2. Streaming responses
3. Simple function calling
4. Basic safety checks
5. Audit logging

### Should Have
1. Multiple LLM providers
2. Advanced function calling
3. Policy engine
4. Report generation
5. Notifications

### Nice to Have
1. Vector search
2. Workflow orchestration
3. Custom models
4. Voice interface
5. Mobile app

## Risk Mitigation

### Technical Risks
1. **LLM API Failures**
   - Mitigation: Implement fallback providers
   - Backup: Cache common responses

2. **Streaming Failures**
   - Mitigation: Implement reconnection logic
   - Backup: Fall back to polling

3. **Rate Limits**
   - Mitigation: Implement queuing
   - Backup: User-level throttling

### Business Risks
1. **Cost Overruns**
   - Mitigation: Token usage monitoring
   - Backup: Usage-based pricing

2. **Compliance Issues**
   - Mitigation: Regular audits
   - Backup: Manual review queue

## Success Metrics

### Technical Metrics
- Response time < 3s (P95)
- Streaming latency < 100ms
- Uptime > 99.9%
- Error rate < 1%

### Business Metrics
- User adoption > 50%
- Daily active users > 100
- Average session length > 10 min
- User satisfaction > 4.5/5

## Next Steps

### Immediate Actions (This Week)
1. Set up OpenAI API account
2. Install required npm packages
3. Create basic completion endpoint
4. Test streaming implementation
5. Update frontend to use real API

### Week 1 Milestones
- [ ] OpenAI integration working
- [ ] Basic streaming functional
- [ ] Frontend connected to backend
- [ ] Error handling implemented
- [ ] Basic monitoring in place

### Decision Points
1. **LLM Provider**: Start with OpenAI, add Claude later?
2. **Streaming Tech**: SSE vs WebSockets?
3. **Function Calling**: OpenAI native vs custom?
4. **Policy Engine**: Build vs buy (OPA)?
5. **Vector DB**: pgvector vs dedicated?

## Conclusion

The Lab Assistant backend implementation is critical for delivering real value to users. With the frontend complete, we can focus entirely on building robust backend services. The phased approach ensures we deliver working features quickly while maintaining security and compliance standards.

The key to success is starting with a simple, working implementation and iteratively adding features based on user feedback. The modular architecture allows for parallel development and easy testing of individual components.

By following this plan, we'll have a fully functional Lab Assistant with real AI capabilities within 6 weeks, transforming how scientists interact with laboratory instruments through natural language.