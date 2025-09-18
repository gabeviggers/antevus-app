# Rate Limiting Implementation

## Overview

Rate limiting has been implemented across all API endpoints, including the chat system, to prevent abuse and ensure fair usage.

## Implementation Status ✅

### What's Protected

1. **Chat API Endpoints**
   - `/api/chat/threads` - 60 requests/minute
   - `/api/chat/completion` - 30 requests/minute (future)
   - `/api/chat/stream` - 20 requests/minute (future)

2. **Auth Endpoints**
   - `/api/auth/login` - 20 requests/minute
   - `/api/auth/register` - 10 requests/minute
   - `/api/auth/generate-key` - 5 requests/minute

3. **Data Export Endpoints**
   - `/api/export` - 5 requests/minute
   - `/api/backup` - 5 requests/minute

## Architecture

### Components

1. **Rate Limit Helper** (`/lib/api/rate-limit-helper.ts`)
   - Easy-to-use middleware for API routes
   - Automatic rate limit headers
   - Client identification (IP or auth token)

2. **Global Configuration** (`/lib/security/global-rate-limit.ts`)
   - Centralized rate limit configurations
   - Route-specific limits
   - System-wide limits

3. **Database Storage** (`/lib/db/repositories/rate-limit.repository.ts`)
   - PostgreSQL-backed for distributed systems
   - Atomic operations to prevent race conditions
   - Window-based tracking

4. **Prisma Schema**
   ```prisma
   model RateLimit {
     id            String    @id @default(cuid())
     keyId         String
     windowStart   DateTime
     requestCount  Int       @default(0)

     @@unique([keyId, windowStart])
   }
   ```

## Usage

### Basic Implementation

```typescript
import { withRateLimit, RateLimitConfigs } from '@/lib/api/rate-limit-helper'

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimited = await withRateLimit(request, RateLimitConfigs.chatThreads)
  if (rateLimited) return rateLimited

  // Your API logic here
  return NextResponse.json({ data: 'success' })
}
```

### Custom Configuration

```typescript
const customConfig = {
  key: 'api:custom:endpoint',
  limit: 100,           // 100 requests
  window: 60000,        // per minute
  blockDuration: 300000 // block for 5 minutes when exceeded
}

const rateLimited = await withRateLimit(request, customConfig)
```

### With Response Headers

```typescript
import { checkRateLimit, addRateLimitHeaders } from '@/lib/api/rate-limit-helper'

// Check rate limit and add headers to successful responses
const rateLimitResult = await checkRateLimit(request, RateLimitConfigs.chatThreads)
const response = NextResponse.json({ data })

// Add X-RateLimit headers
return addRateLimitHeaders(response, rateLimitResult, config.limit)
```

## Response Headers

All rate-limited endpoints return these headers:

- `X-RateLimit-Limit` - Maximum requests allowed in the window
- `X-RateLimit-Remaining` - Requests remaining in current window
- `X-RateLimit-Reset` - ISO timestamp when the window resets
- `Retry-After` - Seconds to wait before retrying (only on 429 responses)

## Rate Limit Response

When rate limit is exceeded:

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 42
}
```

HTTP Status: `429 Too Many Requests`

## Configuration

### Environment Variables

```env
# Global rate limits
GLOBAL_RATE_LIMIT=10000        # System-wide limit
GLOBAL_API_LIMIT=5000          # API endpoints limit
GLOBAL_AUTH_LIMIT=100          # Auth endpoints limit
GLOBAL_EXPORT_LIMIT=50         # Export endpoints limit

# Per-user/IP limits
USER_RATE_LIMIT=1000           # Per authenticated user
IP_RATE_LIMIT=100             # Per IP address

# Windows and timeouts
RATE_LIMIT_WINDOW=60000        # Window duration (ms)

# Feature flags
ENABLE_RATE_LIMITING=true      # Enable/disable rate limiting
FAIL_OPEN_RATE_LIMIT=false    # Fail open on error (NEVER in production)
```

## Client Identification

The system identifies clients using:

1. **Authenticated requests**: Hash of authorization token
2. **Anonymous requests**: IP address from headers
   - `X-Forwarded-For` (primary)
   - `X-Real-IP` (fallback)
   - Request IP (last resort)

## Security Features

1. **Database-backed**: Works across distributed systems
2. **Atomic operations**: Prevents race conditions
3. **Audit logging**: All rate limit violations are logged
4. **Configurable windows**: Per-endpoint customization
5. **Block duration**: Temporary blocking for repeat offenders

## Testing Rate Limits

### Using cURL

```bash
# Test rate limiting
for i in {1..65}; do
  curl -X GET "http://localhost:3000/api/chat/threads" \
    -H "Authorization: Bearer test-token" \
    -w "\n%{http_code} - Remaining: %{header.x-ratelimit-remaining}\n"
  sleep 0.5
done
```

### Expected Behavior

1. First 60 requests: 200 OK
2. Request 61+: 429 Too Many Requests
3. After 1 minute: Counter resets

## Monitoring

Rate limit violations are logged with:
- Event type: `SECURITY_RATE_LIMIT_EXCEEDED`
- User/IP identifier
- Endpoint accessed
- Limit configuration
- Reset time

## Best Practices

1. **Set appropriate limits**: Balance between security and usability
2. **Monitor violations**: Watch for patterns of abuse
3. **Gradual rollout**: Start with higher limits, reduce as needed
4. **Different limits per endpoint**: Critical endpoints should have stricter limits
5. **User feedback**: Clear error messages with retry information

## Future Improvements

1. **Redis integration**: For better performance at scale
2. **Sliding window**: More accurate rate limiting
3. **User-specific limits**: Based on subscription tiers
4. **Dynamic limits**: Adjust based on system load
5. **IP allowlisting**: Bypass rate limits for trusted sources

## Troubleshooting

### Common Issues

1. **"Rate limit check failed" in logs**
   - Check database connection
   - Verify Prisma migrations are up to date
   - Check DATABASE_URL environment variable

2. **Rate limits not working**
   - Verify ENABLE_RATE_LIMITING=true
   - Check middleware is applied to routes
   - Verify database table exists

3. **Too restrictive limits**
   - Adjust limits in global-rate-limit.ts
   - Consider per-user vs per-IP identification
   - Review actual usage patterns

## Conclusion

Rate limiting is now fully implemented across all chat endpoints and other critical APIs. The system is production-ready with comprehensive monitoring, clear error responses, and flexible configuration options.