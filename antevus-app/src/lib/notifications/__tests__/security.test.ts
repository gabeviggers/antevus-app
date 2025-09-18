import {
  escapeHtml,
  redactSensitive,
  isSafeUrl,
  createRateLimiter
} from '../security'

describe('Notification Security', () => {
  describe('escapeHtml', () => {
    it('escapes HTML entities', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      )
    })

    it('escapes all special characters', () => {
      expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#039;')
    })

    it('leaves normal text unchanged', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World')
    })
  })

  describe('redactSensitive', () => {
    it('does not redact when privacy is false', () => {
      const text = 'Patient: John Doe, Sample: ABC123456'
      expect(redactSensitive(text, false)).toBe(text)
    })

    it('redacts patient names when privacy is true', () => {
      const text = 'Patient: John Doe'
      expect(redactSensitive(text, true)).toBe('Patient: [REDACTED]')
    })

    it('redacts sample IDs when privacy is true', () => {
      const text = 'Sample: ABC123456'
      expect(redactSensitive(text, true)).toBe('Sample: [REDACTED]')
    })

    it('redacts emails when privacy is true', () => {
      const text = 'Contact: test@example.com'
      expect(redactSensitive(text, true)).toContain('[EMAIL]')
    })

    it('redacts phone numbers when privacy is true', () => {
      const text = 'Phone: 555-123-4567'
      expect(redactSensitive(text, true)).toContain('[PHONE]')
    })

    it('redacts SSN patterns when privacy is true', () => {
      const text = 'SSN: 123-45-6789'
      expect(redactSensitive(text, true)).toContain('[SSN]')
    })

    it('redacts multiple sensitive items', () => {
      const text = 'Patient: Jane Doe, Email: jane@test.com, Sample: XYZ789'
      const redacted = redactSensitive(text, true)
      expect(redacted).toContain('[REDACTED]')
      expect(redacted).toContain('[EMAIL]')
      expect(redacted.match(/\[REDACTED\]/g)).toHaveLength(2)
    })
  })

  describe('isSafeUrl', () => {
    it('allows relative URLs', () => {
      expect(isSafeUrl('/dashboard')).toBe(true)
      expect(isSafeUrl('/api/data')).toBe(true)
    })

    it('allows http and https URLs', () => {
      expect(isSafeUrl('https://antevus.com')).toBe(true)
      expect(isSafeUrl('http://localhost:3000')).toBe(true)
    })

    it('allows whitelisted domains', () => {
      expect(isSafeUrl('https://docs.antevus.com/guide')).toBe(true)
      expect(isSafeUrl('https://antevus.com/api')).toBe(true)
    })

    it('blocks javascript protocol', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false)
      expect(isSafeUrl('javascript:void(0)')).toBe(false)
    })

    it('blocks data URLs', () => {
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    })

    it('blocks file protocol', () => {
      expect(isSafeUrl('file:///etc/passwd')).toBe(false)
    })

    it('blocks protocol-relative URLs', () => {
      expect(isSafeUrl('//evil.com/steal')).toBe(false)
    })
  })

  describe('createRateLimiter', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('allows requests up to the limit', () => {
      const limiter = createRateLimiter(3)
      expect(limiter()).toBe(true)
      expect(limiter()).toBe(true)
      expect(limiter()).toBe(true)
    })

    it('blocks requests over the limit', () => {
      const limiter = createRateLimiter(3)
      limiter()
      limiter()
      limiter()
      expect(limiter()).toBe(false)
    })

    it('resets after time window', () => {
      const limiter = createRateLimiter(2)
      limiter()
      limiter()
      expect(limiter()).toBe(false)

      // Advance time by 1 minute
      jest.advanceTimersByTime(60000)

      expect(limiter()).toBe(true)
    })

    it('enforces per-source limits', () => {
      const limiter = createRateLimiter(10, 2)

      // Source A
      expect(limiter('sourceA')).toBe(true)
      expect(limiter('sourceA')).toBe(true)
      expect(limiter('sourceA')).toBe(false)

      // Source B should still work
      expect(limiter('sourceB')).toBe(true)
      expect(limiter('sourceB')).toBe(true)
      expect(limiter('sourceB')).toBe(false)
    })

    it('tracks global and per-source limits independently', () => {
      const limiter = createRateLimiter(5, 2)

      // Use up source A limit
      limiter('sourceA')
      limiter('sourceA')

      // Use up source B limit
      limiter('sourceB')
      limiter('sourceB')

      // Global limit not yet reached, but sources are limited
      expect(limiter('sourceA')).toBe(false)
      expect(limiter('sourceB')).toBe(false)

      // Source C should work
      expect(limiter('sourceC')).toBe(true)
    })
  })
})