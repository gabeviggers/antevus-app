// HTML escaping to prevent XSS
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

// Redact sensitive information
export function redactSensitive(text: string, privacy: boolean): string {
  if (!privacy) return text

  // Redact common patterns
  return text
    .replace(/\b[A-Z0-9]{8,}\b/g, '[REDACTED]') // Sample IDs
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]') // SSN pattern
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]') // Emails
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE]') // Phone numbers
    .replace(/patient[:\s]+[\w\s]+/gi, 'Patient: [REDACTED]') // Patient names
    .replace(/sample[:\s]+[\w\s]+/gi, 'Sample: [REDACTED]') // Sample identifiers
}

// Check if URL is safe
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin)
    // Only allow http(s) and internal routes
    if (!['http:', 'https:', ''].includes(parsed.protocol)) return false
    // For external URLs, check against allowlist
    if (parsed.origin !== window.location.origin) {
      const allowedDomains = ['antevus.com', 'docs.antevus.com']
      return allowedDomains.some(domain => parsed.hostname.endsWith(domain))
    }
    return true
  } catch {
    // Relative URLs are safe
    return url.startsWith('/') && !url.startsWith('//')
  }
}

// Sanitize link attributes
export function sanitizeLinkProps(href?: string): Record<string, string> {
  if (!href) return {}

  if (!isSafeUrl(href)) {
    console.warn('Unsafe URL blocked:', href)
    return {}
  }

  const isExternal = href.startsWith('http') && !href.includes(window.location.hostname)

  return {
    href,
    ...(isExternal && {
      target: '_blank',
      rel: 'noopener noreferrer'
    })
  }
}

// Rate limiting helper
export function createRateLimiter(maxPerMinute: number, maxPerSource?: number) {
  const globalTimestamps: number[] = []
  const sourceTimestamps = new Map<string, number[]>()

  return (source?: string) => {
    const now = Date.now()
    const oneMinuteAgo = now - 60000

    // Clean old global timestamps
    while (globalTimestamps.length > 0 && globalTimestamps[0] < oneMinuteAgo) {
      globalTimestamps.shift()
    }

    // Check global rate limit
    if (globalTimestamps.length >= maxPerMinute) {
      return false
    }

    // Check per-source rate limit if applicable
    if (source && maxPerSource) {
      const timestamps = sourceTimestamps.get(source) || []

      // Clean old source timestamps
      while (timestamps.length > 0 && timestamps[0] < oneMinuteAgo) {
        timestamps.shift()
      }

      if (timestamps.length >= maxPerSource) {
        return false
      }

      timestamps.push(now)
      sourceTimestamps.set(source, timestamps)
    }

    globalTimestamps.push(now)
    return true
  }
}