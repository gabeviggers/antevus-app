/**
 * XSS Protection and Content Sanitization
 *
 * SECURITY NOTICE:
 * - All user-generated content must be sanitized before rendering
 * - Use React's built-in JSX escaping for most content
 * - This module provides additional protection for special cases
 * - Never use dangerouslySetInnerHTML with unsanitized content
 */
import { logger } from '@/lib/logger'

/**
 * HTML entities that need escaping to prevent XSS
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
}

/**
 * Escape HTML entities in a string to prevent XSS
 * Use this when rendering user content outside of React's JSX
 */
export function escapeHtml(text: string): string {
  return String(text).replace(/[&<>"'`=\/]/g, (char) => HTML_ENTITIES[char] || char)
}

/**
 * Sanitize user input for safe storage and display
 * Removes potentially dangerous characters and scripts
 */
export function sanitizeInput(input: string): string {
  // Remove any script tags and their contents
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  // Remove event handlers
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '')

  // Remove data: protocol (can be used for XSS)
  sanitized = sanitized.replace(/data:text\/html[^,]*,/gi, '')

  return sanitized.trim()
}

/**
 * Sanitize URL to prevent javascript: and data: protocols
 */
export function sanitizeUrl(url: string): string {
  const trimmed = url.trim().toLowerCase()

  // Block dangerous protocols
  const dangerousProtocols = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'about:'
  ]

  for (const protocol of dangerousProtocols) {
    if (trimmed.startsWith(protocol)) {
      return '#'
    }
  }

  // Only allow http, https, and relative URLs
  if (!trimmed.startsWith('http://') &&
      !trimmed.startsWith('https://') &&
      !trimmed.startsWith('/') &&
      !trimmed.startsWith('#')) {
    return '#'
  }

  return url
}

/**
 * Content Security Policy headers for additional protection
 * Add these to your Next.js config or API responses
 */
export const CSP_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.openai.com",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; ')
}

/**
 * Validate and sanitize JSON data
 * Prevents JSON injection attacks
 */
export function sanitizeJson<T>(data: unknown): T | null {
  try {
    // Convert to string and back to remove any functions or symbols
    const jsonString = JSON.stringify(data)
    const parsed = JSON.parse(jsonString)

    // Additional validation can be added here
    return parsed as T
  } catch (error) {
    logger.error('Invalid JSON data', error)
    return null
  }
}

/**
 * Create safe HTML attributes object
 * Filters out dangerous attributes and event handlers
 */
export function safeAttributes(attrs: Record<string, unknown>): Record<string, string> {
  const safe: Record<string, string> = {}

  for (const [key, value] of Object.entries(attrs)) {
    // Skip event handlers
    if (key.toLowerCase().startsWith('on')) {
      continue
    }

    // Skip dangerous attributes
    if (['srcdoc', 'innerHTML', 'outerHTML'].includes(key)) {
      continue
    }

    // Sanitize URLs in href and src
    if (key === 'href' || key === 'src') {
      safe[key] = sanitizeUrl(String(value))
    } else {
      safe[key] = escapeHtml(String(value))
    }
  }

  return safe
}

/**
 * Security headers middleware for Next.js
 * Add to your next.config.js
 */
export const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  }
]

/**
 * Note: React automatically escapes content in JSX
 * When rendering user content, simply use:
 * <div>{userContent}</div>
 *
 * This is safe by default. Only use dangerouslySetInnerHTML
 * if you absolutely need HTML rendering and have properly
 * sanitized the content first.
 */

/**
 * Validate and sanitize file uploads
 */
export function validateFileUpload(file: File): { valid: boolean; error?: string } {
  const MAX_SIZE = 10 * 1024 * 1024 // 10MB
  const ALLOWED_TYPES = [
    'text/csv',
    'application/json',
    'text/plain',
    'application/pdf'
  ]

  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'File too large (max 10MB)' }
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'File type not allowed' }
  }

  // Check for executable extensions
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.app']
  const fileName = file.name.toLowerCase()

  for (const ext of dangerousExtensions) {
    if (fileName.endsWith(ext)) {
      return { valid: false, error: 'Executable files not allowed' }
    }
  }

  return { valid: true }
}

/**
 * DOM Purify configuration for advanced HTML sanitization
 * Note: Requires installing dompurify package for production use
 */
export const domPurifyConfig = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  ADD_TAGS: [],
  ADD_ATTR: [],
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick']
}

// Export security warning for developers
export const XSS_SECURITY_WARNING = `
⚠️ XSS PREVENTION GUIDELINES:

ALWAYS DO:
✅ Use React's JSX for rendering (auto-escapes)
✅ Validate and sanitize all user inputs
✅ Use Content Security Policy headers
✅ Sanitize URLs before rendering
✅ Validate file uploads strictly

NEVER DO:
❌ Use dangerouslySetInnerHTML with user content
❌ Eval user input or use Function constructor
❌ Trust client-side validation alone
❌ Store sensitive data in DOM attributes
❌ Use document.write or innerHTML directly

EXAMPLE SAFE PATTERNS:
// Safe - React auto-escapes
<div>{userInput}</div>

// Safe - Sanitized URL
<a href={sanitizeUrl(userUrl)}>Link</a>

// Safe - Escaped attributes
<div {...safeAttributes(userAttrs)} />

EXAMPLE DANGEROUS PATTERNS:
// DANGEROUS - XSS vulnerability
<div dangerouslySetInnerHTML={{__html: userInput}} />

// DANGEROUS - Script injection
eval(userCode)

// DANGEROUS - Direct DOM manipulation
element.innerHTML = userContent
`

// XSS warning disabled to avoid console spam