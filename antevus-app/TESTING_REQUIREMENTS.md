# Testing Requirements for Lab Assistant

## Current Status

**Coverage: 0%** - No unit tests currently exist. This document outlines what needs to be tested.

## Priority Testing Areas

### 1. Critical Security Components (HIGH PRIORITY)

#### Rate Limiting (`/lib/api/rate-limit-helper.ts`)
```typescript
describe('Rate Limiting', () => {
  it('should limit requests to configured threshold')
  it('should return 429 when limit exceeded')
  it('should reset after time window')
  it('should track per-IP and per-auth separately')
  it('should include proper headers in responses')
})
```

#### XSS Protection (`/lib/security/xss-protection.ts`)
```typescript
describe('XSS Protection', () => {
  it('should sanitize HTML input')
  it('should preserve safe markdown')
  it('should remove script tags')
  it('should handle nested XSS attempts')
})
```

#### Authentication & Authorization
```typescript
describe('Authorization', () => {
  it('should enforce role-based access')
  it('should validate JWT tokens')
  it('should handle expired sessions')
  it('should audit unauthorized attempts')
})
```

### 2. Chat Functionality (MEDIUM PRIORITY)

#### Chat Context (`/contexts/chat-context.tsx`)
```typescript
describe('Chat Context', () => {
  it('should create new threads')
  it('should add messages to threads')
  it('should handle streaming updates')
  it('should persist to secure storage')
  it('should handle encryption/decryption')
  it('should enforce message limits')
  it('should archive old threads')
})
```

#### Chat API Routes (`/app/api/chat/threads/route.ts`)
```typescript
describe('Chat API', () => {
  it('should require authentication')
  it('should enforce rate limits')
  it('should encrypt thread data')
  it('should validate input data')
  it('should handle errors gracefully')
  it('should log audit events')
})
```

#### Error Boundary (`/components/chat/chat-error-boundary.tsx`)
```typescript
describe('Chat Error Boundary', () => {
  it('should catch component errors')
  it('should display fallback UI')
  it('should log errors securely')
  it('should allow recovery')
  it('should track error frequency')
})
```

### 3. UI Components (LOW PRIORITY)

#### Assistant Page (`/app/(dashboard)/assistant/page.tsx`)
```typescript
describe('Assistant Page', () => {
  it('should render without errors')
  it('should handle permission denial')
  it('should show loading states')
  it('should sanitize user input')
  it('should handle message submission')
  it('should display error states')
})
```

#### Loading States
```typescript
describe('Loading States', () => {
  it('should show skeleton during load')
  it('should indicate thinking state')
  it('should disable inputs while loading')
  it('should handle timeout gracefully')
})
```

## Testing Setup Required

### 1. Install Testing Dependencies
```bash
npm install --save-dev \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  jest \
  jest-environment-jsdom \
  @types/jest
```

### 2. Configure Jest
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
  ],
}
```

### 3. Create Test Utilities
```typescript
// test-utils/render.tsx
import { render } from '@testing-library/react'
import { ChatProvider } from '@/contexts/chat-context'
import { SessionProvider } from '@/contexts/session-context'

export function renderWithProviders(ui: React.ReactElement) {
  return render(
    <SessionProvider>
      <ChatProvider>
        {ui}
      </ChatProvider>
    </SessionProvider>
  )
}
```

## Sample Test Implementation

### Rate Limiting Test Example
```typescript
// __tests__/lib/api/rate-limit-helper.test.ts
import { checkRateLimit } from '@/lib/api/rate-limit-helper'
import { NextRequest } from 'next/server'

describe('checkRateLimit', () => {
  it('should allow requests within limit', async () => {
    const request = new NextRequest('http://localhost/api/test')
    const config = { key: 'test', limit: 5, window: 60000 }

    const result = await checkRateLimit(request, config)

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('should block after limit exceeded', async () => {
    const request = new NextRequest('http://localhost/api/test')
    const config = { key: 'test', limit: 1, window: 60000 }

    // First request should succeed
    await checkRateLimit(request, config)

    // Second request should fail
    const result = await checkRateLimit(request, config)

    expect(result.success).toBe(false)
    expect(result.response?.status).toBe(429)
  })
})
```

### Chat Context Test Example
```typescript
// __tests__/contexts/chat-context.test.tsx
import { renderHook, act } from '@testing-library/react'
import { useChat, ChatProvider } from '@/contexts/chat-context'

describe('useChat', () => {
  it('should create a new thread', () => {
    const { result } = renderHook(() => useChat(), {
      wrapper: ChatProvider
    })

    act(() => {
      const threadId = result.current.createThread('Test Thread')
      expect(threadId).toBeDefined()
    })

    expect(result.current.threads).toHaveLength(1)
    expect(result.current.threads[0].title).toBe('Test Thread')
  })

  it('should add messages to thread', () => {
    const { result } = renderHook(() => useChat(), {
      wrapper: ChatProvider
    })

    act(() => {
      result.current.createThread('Test')
      result.current.addMessage({
        role: 'user',
        content: 'Hello'
      })
    })

    expect(result.current.activeThread?.messages).toHaveLength(1)
  })
})
```

## Testing Strategy

### Phase 1: Security & Core Functions (Week 1)
- Rate limiting
- Authentication/Authorization
- XSS protection
- Encryption/Decryption
- Audit logging

### Phase 2: Business Logic (Week 2)
- Chat thread management
- Message handling
- API endpoints
- Error boundaries
- State management

### Phase 3: UI & Integration (Week 3)
- Component rendering
- User interactions
- Loading states
- Error handling
- End-to-end flows

## Success Metrics

- **Unit Test Coverage**: Target 80% for critical paths
- **Security Test Coverage**: 100% for auth and rate limiting
- **Integration Tests**: All API endpoints
- **E2E Tests**: Core user journeys
- **Performance**: Tests run in <30 seconds

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v2
```

## Notes

While implementing tests is important for production, the current focus should be on:

1. **Immediate security concerns** - The rate limiting and security features are now implemented
2. **Core functionality** - The chat system works with proper error handling
3. **User experience** - Loading states and error boundaries are in place

Tests can be added incrementally as the backend is built out, prioritizing security-critical components first.