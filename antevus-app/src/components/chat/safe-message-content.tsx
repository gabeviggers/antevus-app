/**
 * Safe Message Content Renderer
 *
 * SECURITY NOTICE:
 * - This component safely renders user-generated content
 * - Prevents XSS attacks through proper sanitization
 * - Uses React's built-in escaping for maximum security
 */

'use client'

import { useMemo } from 'react'
import { sanitizeInput } from '@/lib/security/xss-protection'

interface SafeMessageContentProps {
  content: string
  isStreaming?: boolean
  renderMarkdown?: boolean
}

/**
 * Safely render message content with XSS protection
 *
 * Security measures:
 * 1. Input sanitization to remove scripts and dangerous content
 * 2. React's built-in JSX escaping
 * 3. No use of dangerouslySetInnerHTML
 * 4. Safe markdown rendering for assistant messages
 */
export function SafeMessageContent({
  content,
  isStreaming = false,
  renderMarkdown = false
}: SafeMessageContentProps) {
  // Sanitize content to remove any malicious scripts or HTML
  const sanitizedContent = useMemo(() => {
    return sanitizeInput(content)
  }, [content])

  // Process content for display (with safe markdown if needed)
  const displayContent = useMemo(() => {
    if (!renderMarkdown) {
      return sanitizedContent
    }

    // Split content into parts for safe rendering
    const parts: Array<{ type: 'text' | 'bold' | 'code', content: string }> = []
    let remaining = sanitizedContent

    // Process bold text (**text**)
    const boldRegex = /\*\*([^*]+)\*\*/
    while (boldRegex.test(remaining)) {
      const match = remaining.match(boldRegex)
      if (match && match.index !== undefined) {
        // Add text before bold
        if (match.index > 0) {
          parts.push({ type: 'text', content: remaining.slice(0, match.index) })
        }
        // Add bold text
        parts.push({ type: 'bold', content: match[1] })
        // Continue with remaining text
        remaining = remaining.slice(match.index + match[0].length)
      }
    }

    // Add any remaining text
    if (remaining) {
      parts.push({ type: 'text', content: remaining })
    }

    return parts
  }, [sanitizedContent, renderMarkdown])

  // Render with markdown support (safe because we're not using dangerouslySetInnerHTML)
  if (renderMarkdown && Array.isArray(displayContent)) {
    return (
      <div className="whitespace-pre-wrap break-words">
        {displayContent.map((part, index) => {
          switch (part.type) {
            case 'bold':
              return <strong key={index}>{part.content}</strong>
            case 'code':
              return (
                <code key={index} className="px-1 py-0.5 bg-muted rounded text-sm">
                  {part.content}
                </code>
              )
            default:
              // Split text by newlines for proper line breaks
              return part.content.split('\n').map((line, lineIndex) => (
                <span key={`${index}-${lineIndex}`}>
                  {lineIndex > 0 && <br />}
                  {line}
                </span>
              ))
          }
        })}
        {isStreaming && (
          <span className="inline-block w-1 h-4 ml-1 bg-current animate-pulse" />
        )}
      </div>
    )
  }

  // For plain text, React automatically escapes it (safest option)
  // Split by newlines to preserve line breaks
  const lines = sanitizedContent.split('\n')
  return (
    <div className="whitespace-pre-wrap break-words">
      {lines.map((line, index) => (
        <span key={index}>
          {index > 0 && <br />}
          {line}
        </span>
      ))}
      {isStreaming && (
        <span className="inline-block w-1 h-4 ml-1 bg-current animate-pulse" />
      )}
    </div>
  )
}

export default SafeMessageContent