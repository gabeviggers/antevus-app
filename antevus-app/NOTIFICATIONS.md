# Antevus Notifications System

## Overview

The Antevus notification system provides comprehensive real-time feedback through toasts, inline banners, and optional desktop notifications. Built with security, privacy, and minimalism at its core.

## Quick Start

### Basic Usage

```typescript
import { useNotifications } from '@/hooks/use-notifications'

function MyComponent() {
  const { notify } = useNotifications()

  const handleSuccess = () => {
    notify({
      severity: 'success',
      title: 'Operation completed',
      description: 'Your data has been saved successfully'
    })
  }
}
```

### Report Generation Example

```typescript
import { useReportNotifications } from '@/hooks/use-report-notifications'

function ReportGenerator() {
  const { notifyReportGenerating, notifyReportGenerated } = useReportNotifications()

  const generateReport = async () => {
    // Start notification
    notifyReportGenerating('Monthly Analysis')

    // Do the work
    const reportId = await generateReportAPI()

    // Success notification
    notifyReportGenerated('Monthly Analysis', reportId)
  }
}
```

## Notification Channels

### 🔔 Toast Notifications
- **Use for**: Transient feedback, completed actions, non-critical warnings
- **Duration**: 3-8 seconds (auto-dismiss)
- **Examples**: "Run completed", "Report generated", "Connection restored"

### 📍 Inline Banners
- **Use for**: Context-specific errors, compliance gates, persistent warnings
- **Duration**: Until resolved/dismissed
- **Examples**: "E-signature required", "Validation errors", "Quota exceeded"

### 💻 Desktop Notifications
- **Use for**: Long-running operations, critical alerts (when tab unfocused)
- **Requirements**: User permission, privacy mode for sensitive data
- **Never use for**: Compliance actions, payment issues, PHI/PII data

## API Reference

### notify() Options

```typescript
interface NotificationOptions {
  // Required
  severity: 'info' | 'success' | 'warning' | 'error'
  title: string

  // Optional
  description?: string          // Additional details
  actions?: Action[]            // Up to 2 action buttons
  sticky?: boolean              // Don't auto-dismiss
  ttl?: number                  // Custom timeout (ms)
  privacy?: boolean             // Redact sensitive info
  source?: string               // For grouping/filtering
  correlationId?: string        // For coalescing
  desktopEnabled?: boolean      // Enable desktop notification
}
```

### Action Buttons

```typescript
interface NotificationAction {
  label: string
  href?: string                 // Navigate to URL
  onClick?: () => void         // Custom handler
  variant?: 'default' | 'destructive'
}
```

## Common Patterns

### Run Lifecycle

```typescript
// Run started
notify({
  severity: 'info',
  title: `Run #${runId} started`,
  description: `Running on ${instrument}`,
  source: 'runs'
})

// Run completed
notify({
  severity: 'success',
  title: `Run #${runId} completed`,
  description: `Completed in ${duration}`,
  actions: [{
    label: 'View results',
    href: `/runs/${runId}`
  }],
  desktopEnabled: true
})

// Run failed
notify({
  severity: 'error',
  title: `Run #${runId} failed`,
  description: error.message,
  sticky: true,
  actions: [
    { label: 'View logs', href: `/runs/${runId}/logs` },
    { label: 'Retry', onClick: retryRun }
  ]
})
```

### Connection Status

```typescript
// Connection lost
notify({
  severity: 'warning',
  title: 'Connection lost',
  description: 'Attempting to reconnect...',
  sticky: true,
  source: 'connection'
})

// Connection restored
notify({
  severity: 'success',
  title: 'Connection restored',
  source: 'connection'
})
```

### Data Export

```typescript
// Export started
notify({
  severity: 'info',
  title: 'Preparing export...',
  source: 'export'
})

// Export ready
notify({
  severity: 'success',
  title: 'Export ready',
  description: `${fileName} (${fileSize})`,
  actions: [{
    label: 'Download',
    onClick: downloadFile
  }],
  desktopEnabled: true
})
```

## Copy Writing Guide

### ✅ Good Patterns
- `"{entity} {action}"` - "Report generated"
- `"#{id} {status}"` - "#R-001 completed"
- `"{action} failed: {reason}"` - "Connection failed: timeout"

### ❌ Avoid
- "Success!" - Too vague
- "Error occurred" - Not helpful
- "The operation completed successfully" - Too verbose

### Variables
- IDs: `#{id}` or `{id}`
- Durations: "2 minutes", "45 seconds"
- Counts: "1,234 records"
- Sizes: "2.4 MB"

## Security & Privacy

### Automatic Protection
1. **HTML Escaping**: All content automatically escaped
2. **URL Validation**: Only safe protocols allowed
3. **Rate Limiting**: 20/minute global, 5/minute per source

### Privacy Mode
When `privacy: true`:
- Sample IDs → `[REDACTED]`
- Emails → `[EMAIL]`
- Patient names → `Patient: [REDACTED]`

### Desktop Notifications
- Requires explicit user permission
- Respects Do Not Disturb hours
- Generic messages in privacy mode

## Configuration

Edit `/config/notifications.ts`:

```typescript
{
  maxVisible: 4,          // Max toasts shown
  maxQueue: 10,          // Max in queue
  defaultTTL: {
    info: 5000,
    success: 4000,
    warning: 8000,
    error: 0             // Sticky
  },
  coalesceWindow: 10000, // Group similar events
  maxPerMinute: 20,      // Rate limit
}
```

## Testing

### Unit Tests
```bash
npm test src/lib/notifications/__tests__/
```

Tests cover:
- HTML escaping
- Privacy redaction
- URL validation
- Rate limiting
- Desktop permissions
- DND windows

### Manual Testing
A demo component is available on the dashboard:
1. Navigate to `/dashboard`
2. Use the "Notification Examples" card
3. Test different severity levels and actions

## Keyboard Shortcuts

- `Esc` - Dismiss latest toast
- `Cmd/Ctrl + Shift + D` - Dismiss all toasts

## Adding New Triggers

1. **Identify the event** in the audit doc
2. **Choose severity** (info/success/warning/error)
3. **Add notification call**:

```typescript
// In your event handler
notify({
  severity: 'success',
  title: 'Your event happened',
  description: 'Optional details',
  source: 'your-feature',
  actions: [{
    label: 'View',
    href: '/your-page'
  }]
})
```

## Best Practices

### DO ✅
- Keep titles concise (<50 chars)
- Provide actionable next steps
- Use consistent copy patterns
- Group related notifications with `source`
- Enable desktop for long-running ops

### DON'T ❌
- Show toast for every action
- Include PHI in desktop notifications
- Create sticky info toasts
- Exceed 2 action buttons
- Bypass rate limiting

## Troubleshooting

### Toasts not appearing
1. Check browser console for errors
2. Verify `ToastContainer` in layout
3. Check rate limiting logs

### Desktop notifications not working
1. Check browser permissions
2. Verify not in DND window
3. Check `desktopEnabled` flag

### Notifications dismissed too quickly
- Set `sticky: true` for errors
- Increase `ttl` for specific notifications
- Adjust global TTL in config

## Implementation Status

✅ **Completed**
- Enhanced toast system with severity levels
- Desktop notification support
- Privacy mode and redaction
- Rate limiting
- Coalescing similar events
- Security (XSS protection, URL validation)
- Keyboard shortcuts
- Test coverage

🚧 **In Progress**
- Integration with all pages
- WebSocket/SSE event triggers
- Analytics tracking

📋 **Planned**
- Sound effects (optional)
- Notification center/history
- User preferences UI
- Bulk action notifications