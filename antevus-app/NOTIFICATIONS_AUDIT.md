# Antevus Notification System Audit & Decision Document

## Executive Summary
This document audits all notification touchpoints in the Antevus platform and defines when to use toasts vs inline notifications vs desktop notifications. It includes copy patterns, security requirements, and implementation guidelines.

## Notification Channels Decision Matrix

### Toast Notifications (Ephemeral Feedback)
- **Duration**: 3-8 seconds auto-dismiss
- **Use for**: Non-critical, transient feedback
- **Avoid for**: Errors requiring action, compliance gates, sensitive data

### Inline Notifications (Contextual Feedback)
- **Duration**: Persistent until resolved
- **Use for**: Validation errors, compliance requirements, contextual warnings
- **Avoid for**: Global system events, background processes

### Desktop Notifications (Background Alerts)
- **Duration**: OS-controlled
- **Use for**: Long-running operations, critical alerts when tab unfocused
- **Never use for**: PHI/PII data, payment info, compliance actions

## Comprehensive Event-to-Notification Mapping

| Feature Area | Event Trigger | Current Implementation | Severity | Channel | Copy Pattern | Actions | Privacy | Priority |
|---|---|---|---|---|---|---|---|---|
| **API Playground** |||||||||
| API Keys | Key created | ✅ Has toast | success | toast | "API key created. Store securely." | Copy | no | P0 |
| API Keys | Key deleted | ✅ Has toast | success | toast | "API key deleted" | - | no | P0 |
| API Keys | Key copy | ✅ Has toast | info | toast | "Copied to clipboard" | - | no | P0 |
| API Keys | Creation failed | ✅ Has toast | error | toast | "Failed to create API key" | Retry | no | P0 |
| API Keys | Deletion failed | ✅ Has toast | error | toast | "Failed to delete API key" | Retry | no | P0 |
| **Instruments Dashboard** |||||||||
| Instruments | Status change | ❌ Missing | info | toast | "{name} is now {status}" | View | no | P1 |
| Instruments | Error detected | ❌ Missing | error | toast + desktop | "{name}: {error}" | View logs | no | P0 |
| Instruments | Maintenance due | ❌ Missing | warning | inline banner | "{name} maintenance in {days}d" | Schedule | no | P1 |
| Instruments | Refresh complete | ❌ Missing | success | toast | "Instruments refreshed" | - | no | P2 |
| **Run History** |||||||||
| Runs | Run started | ❌ Missing | info | toast | "Run #{id} started" | View | no | P0 |
| Runs | Run completed | ❌ Missing | success | toast + desktop | "Run #{id} completed ({duration})" | View results | maybe | P0 |
| Runs | Run failed | ❌ Missing | error | toast (sticky) | "Run #{id} failed: {reason}" | View logs, Retry | yes | P0 |
| Runs | Export started | ❌ Missing | info | toast | "Exporting {count} runs..." | - | no | P1 |
| Runs | Export complete | ❌ Missing | success | toast + desktop | "Export ready ({size})" | Download | no | P1 |
| Runs | QC failed | ❌ Missing | warning | toast + inline | "QC failed for #{id}" | Review | yes | P0 |
| Runs | Batch complete | ❌ Missing | success | toast + desktop | "{count} runs completed" | View batch | no | P1 |
| **Monitoring** |||||||||
| Monitoring | Connection lost | ❌ Missing | warning | toast (sticky) | "Connection lost. Retrying..." | - | no | P0 |
| Monitoring | Connection restored | ❌ Missing | success | toast | "Connection restored" | - | no | P0 |
| Monitoring | Data export | ❌ Missing | success | toast | "Data exported to CSV" | Download | no | P1 |
| Monitoring | Threshold exceeded | ❌ Missing | warning | toast + inline | "{metric} exceeded threshold" | View | no | P0 |
| Monitoring | Pause/Resume | ❌ Missing | info | toast | "Monitoring {paused\|resumed}" | - | no | P2 |
| **Integrations** |||||||||
| Integrations | Connected | ❌ Missing | success | toast | "{service} connected" | Configure | no | P0 |
| Integrations | Disconnected | ❌ Missing | info | toast | "{service} disconnected" | - | no | P0 |
| Integrations | Connection failed | ❌ Missing | error | toast (sticky) | "Failed to connect {service}" | Retry | no | P0 |
| Integrations | Sync started | ❌ Missing | info | toast | "Syncing with {service}..." | - | no | P1 |
| Integrations | Sync complete | ❌ Missing | success | toast | "Synced {count} records" | View | no | P1 |
| Integrations | Sync failed | ❌ Missing | error | toast (sticky) | "Sync failed: {reason}" | Retry, View logs | no | P0 |
| Integrations | Config saved | ❌ Missing | success | toast | "Configuration saved" | - | no | P1 |
| **Lab Assistant** |||||||||
| Assistant | Message sent | ❌ Not needed | - | - | - | - | - | - |
| Assistant | Response received | ❌ Not needed | - | - | - | - | - | - |
| Assistant | Action blocked | ❌ Missing | warning | inline only | "Action requires approval" | Review policy | no | P0 |
| Assistant | Thread saved | ❌ Missing | info | toast | "Conversation saved" | - | no | P2 |
| Assistant | Rate limited | ❌ Missing | warning | inline + toast | "Rate limit reached. Try again in {time}" | - | no | P0 |
| Assistant | Context limit | ❌ Missing | warning | inline only | "Approaching context limit" | - | no | P1 |
| Assistant | Error | ❌ Missing | error | inline + toast | "Assistant error: {message}" | Retry | yes | P0 |
| **Reports & Data** |||||||||
| Reports | Report generating | ❌ Missing | info | toast | "Generating report..." | - | no | P1 |
| Reports | Report generated | ❌ Missing | success | toast + desktop | "Report '{name}' ready" | View | maybe | P0 |
| Reports | Report failed | ❌ Missing | error | toast (sticky) | "Report generation failed" | Retry | no | P0 |
| Data | Processing | ❌ Missing | info | toast | "Processing data..." | - | yes | P1 |
| Data | Processing complete | ❌ Missing | success | toast | "Data processing complete" | View | yes | P1 |
| **System & Auth** |||||||||
| Auth | Session expiring | ❌ Missing | warning | toast (sticky) | "Session expires in {time}" | Extend | no | P0 |
| Auth | Session expired | ❌ Missing | error | modal only | - | Sign in | no | P0 |
| Auth | Permission denied | ❌ Missing | error | inline only | "You don't have permission" | - | yes | P0 |
| System | Update available | ❌ Missing | info | toast | "Antevus v{version} available" | Update | no | P2 |
| System | Storage warning | ❌ Missing | warning | toast | "Using {percent}% of storage" | Manage | no | P1 |
| **Usage & Billing** |||||||||
| Usage | 80% threshold | ❌ Missing | info | toast | "80% of {meter} used" | View usage | no | P0 |
| Usage | 95% threshold | ❌ Missing | warning | toast (sticky) | "95% of {meter} used" | Upgrade | no | P0 |
| Usage | Quota exceeded | ❌ Missing | error | banner + toast | "{meter} quota exceeded" | Manage plan | no | P0 |
| Billing | Payment failed | ❌ Missing | error | banner only | - | Update payment | yes | P0 |
| **Compliance** |||||||||
| Compliance | E-sign required | ❌ Missing | info | inline banner only | "E-signature required" | Sign | yes | P0 |
| Compliance | Audit exported | ❌ Missing | success | toast | "Audit log exported" | Download | no | P1 |
| Compliance | Retention warning | ❌ Missing | warning | inline banner | "{count} records scheduled for deletion" | Review | yes | P0 |

## Copy Writing Patterns

### Success Patterns
```
✅ "{entity} {action}" - "Report generated"
✅ "{action} complete" - "Export complete"
✅ "#{id} {status}" - "#R-001 completed"
❌ "Success!" - Too vague
❌ "The operation completed successfully" - Too verbose
```

### Error Patterns
```
✅ "{action} failed: {reason}" - "Connection failed: timeout"
✅ "Cannot {action}: {reason}" - "Cannot export: insufficient permissions"
❌ "Error occurred" - Not helpful
❌ "Something went wrong" - Too vague
```

### Variable Formatting
- IDs: `#{id}` or `{id}` for short IDs
- Durations: Human readable - "2 minutes", "45 seconds"
- Counts: With commas - "1,234 records"
- Percentages: With % - "85%"
- File sizes: Human readable - "2.4 MB"

## Security & Privacy Requirements

### Content Security
1. **HTML Escaping**: All user content must be escaped
2. **No Raw HTML**: Never render HTML/Markdown in toasts
3. **Safe URLs**: Validate all links, add rel="noopener noreferrer"

### Privacy Controls
1. **Redaction Patterns** (when privacy=true):
   - Sample IDs: `[REDACTED]`
   - Patient names: `Patient: [REDACTED]`
   - Email: `[EMAIL]`
   - Phone: `[PHONE]`
   - SSN: `[SSN]`

2. **Desktop Notification Rules**:
   - Never show PHI/PII
   - Generic titles when privacy mode enabled
   - No desktop for compliance actions

### Rate Limiting
- Max 20 toasts per minute global
- Max 5 per source per minute
- Coalesce similar events within 10s window

## Implementation Priority

### P0 - Critical (Week 1)
- Run status notifications (started, completed, failed)
- Connection status (lost, restored)
- Error notifications with retry actions
- Session management
- Usage quota warnings

### P1 - Important (Week 2)
- Export/Report generation
- Integration sync status
- QC failures
- Threshold alerts
- Storage warnings

### P2 - Nice to have (Week 3)
- Update notifications
- Thread saved confirmations
- Refresh confirmations
- Minor status changes

## Technical Implementation Plan

### 1. Enhanced Toast System
```typescript
// Enhance existing toast with:
- Severity levels (info, success, warning, error)
- Sticky option for errors
- Action buttons
- Privacy mode
- Desktop notification trigger
```

### 2. Notification Service
```typescript
// Central service for:
- Event subscription
- Toast triggering
- Desktop permission management
- Rate limiting
- Coalescing logic
```

### 3. Integration Points
```typescript
// Key integration files:
- /app/(dashboard)/runs/page.tsx - Run lifecycle
- /app/(dashboard)/monitoring/page.tsx - Real-time updates
- /app/(dashboard)/integrations/page.tsx - Sync status
- /lib/api-client.ts - API errors
- /contexts/session-context.tsx - Auth events
```

### 4. Desktop Notification Handler
```typescript
// Features:
- Permission request flow
- Privacy mode
- Click-to-focus
- DND hours
```

## Testing Requirements

### Unit Tests
- Toast queueing and dismissal
- Rate limiting logic
- Privacy redaction
- Coalescing behavior

### Integration Tests
- Run lifecycle notifications
- Error handling flows
- Desktop permission flow
- Session expiry warnings

### E2E Tests
- Complete user journey with notifications
- Multi-tab behavior
- Background/foreground transitions

## Accessibility Requirements

1. **Screen Readers**: Proper ARIA labels and live regions
2. **Keyboard Navigation**: Esc to dismiss, Tab through actions
3. **Focus Management**: Return focus after dismissal
4. **Reduced Motion**: Respect prefers-reduced-motion

## Monitoring & Analytics

### Metrics to Track
- Notification shown count by type
- Click-through rates on actions
- Dismissal patterns
- Desktop permission grant rate
- Error notification frequency

### Events to Log
```typescript
{
  event: 'notification_shown',
  severity: 'error',
  source: 'runs',
  hasAction: true,
  dismissed: false,
  timeVisible: 5000
}
```

## Migration Plan

1. **Phase 1**: Implement enhanced toast system
2. **Phase 2**: Add P0 notification triggers
3. **Phase 3**: Desktop notifications + P1 triggers
4. **Phase 4**: Complete P2 + analytics

## Success Criteria

- ✅ All P0 events trigger appropriate notifications
- ✅ <100ms notification display latency
- ✅ Zero security vulnerabilities
- ✅ 100% of errors have actionable notifications
- ✅ Desktop notification adoption >30%
- ✅ User satisfaction score >4.5/5