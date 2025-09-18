'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Send, Sparkles, Beaker, Activity, FileText, AlertCircle, Share2, MoreVertical, Archive, Flag, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useChat } from '@/contexts/chat-context'
import { sanitizeInput } from '@/lib/security/xss-protection'
import { SafeMessageContent } from '@/components/chat/safe-message-content'
import { auditLogger, AuditEventType } from '@/lib/security/audit-logger'
import { authorizationService, Resource, Action, UserRole } from '@/lib/security/authorization'
import { useSession } from '@/contexts/session-context'
import { PermissionDenied } from '@/components/auth/permission-denied'
import { ChatErrorBoundary } from '@/components/chat/chat-error-boundary'
import { useRouter } from 'next/navigation'
import { logger } from '@/lib/logger'

interface SuggestedPrompt {
  icon: React.ReactNode
  title: string
  prompt: string
}

function AssistantPageContent() {
  const { activeThread, addMessage, updateMessage, switchThread, renameThread, deleteThread } = useChat()
  const { user, isLoading: sessionLoading } = useSession()
  const router = useRouter()
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [authError, setAuthError] = useState<{ requiredRole?: string; message?: string } | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const currentThreadIdRef = useRef<string | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Use activeThread messages directly, no local state
  const messages = useMemo(() => activeThread?.messages || [], [activeThread?.messages])

  // Track the current thread ID
  useEffect(() => {
    currentThreadIdRef.current = activeThread?.id || null
  }, [activeThread?.id])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Check authorization when user changes
  useEffect(() => {
    const checkAuthorization = async () => {
      if (!user) {
        setHasPermission(false)
        setAuthError({ message: 'You must be logged in to use the Lab Assistant' })
        return
      }

      const result = await authorizationService.can({
        user,
        resource: Resource.ASSISTANT,
        action: Action.EXECUTE
      })

      setHasPermission(result.allowed)

      if (!result.allowed) {
        setAuthError({
          requiredRole: result.requiredRole,
          message: result.reason || 'You do not have permission to use the Lab Assistant'
        })
      } else {
        setAuthError(null)
      }
    }

    if (!sessionLoading) {
      checkAuthorization()
    }
  }, [user, sessionLoading])

  // Audit log: Track page access (only if authorized)
  useEffect(() => {
    if (hasPermission && user) {
      auditLogger.log({
        eventType: AuditEventType.CHAT_HISTORY_VIEWED,
        action: 'Lab Assistant page accessed',
        userId: user.id,
        metadata: {
          activeThreadId: activeThread?.id || null,
          threadCount: messages.length,
          userRole: user.roles
        }
      })

      return () => {
        // Log when user leaves the page
        auditLogger.log({
          eventType: AuditEventType.CHAT_HISTORY_VIEWED,
          action: 'Lab Assistant page exited',
          userId: user.id,
          metadata: {
            activeThreadId: activeThread?.id || null,
            sessionDuration: 'tracked_server_side'
          }
        })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPermission, user])

  const suggestedPrompts: SuggestedPrompt[] = [
    {
      icon: <Activity className="h-5 w-5" />,
      title: "Check instrument status",
      prompt: "What instruments are currently running?"
    },
    {
      icon: <Beaker className="h-5 w-5" />,
      title: "Start a protocol",
      prompt: "Start ELISA protocol on plate reader PR-07"
    },
    {
      icon: <FileText className="h-5 w-5" />,
      title: "Generate report",
      prompt: "Summarize today's qPCR runs and failed tests"
    },
    {
      icon: <AlertCircle className="h-5 w-5" />,
      title: "Check for errors",
      prompt: "Show me all instruments with errors or maintenance needs"
    }
  ]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt)
    textareaRef.current?.focus()
  }

  const simulateStreaming = async (threadId: string, messageId: string, responseText: string) => {
    const words = responseText.split(' ')
    let currentText = ''
    const streamingTimeouts: NodeJS.Timeout[] = []

    try {
      for (let i = 0; i < words.length; i++) {
        currentText += (i === 0 ? '' : ' ') + words[i]
        const isStreaming = i < words.length - 1

        updateMessage(threadId, messageId, currentText, isStreaming)
        // Use smaller delay for smoother streaming
        await new Promise<void>(resolve => {
          const timeout = setTimeout(resolve, 20)
          streamingTimeouts.push(timeout)
        })
      }
    } finally {
      // Clean up any remaining timeouts
      streamingTimeouts.forEach(timeout => clearTimeout(timeout))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const originalInput = input.trim()
    // Sanitize user input to prevent XSS
    const userContent = sanitizeInput(originalInput)

    // Audit log: Check if XSS was prevented
    if (originalInput !== userContent) {
      auditLogger.logSecurityEvent('xss', {
        action: 'Input sanitization applied',
        originalLength: originalInput.length,
        sanitizedLength: userContent.length,
        difference: originalInput.length - userContent.length,
        source: 'chat_input'
      })
    }

    setInput('')
    setIsLoading(true)

    try {
      // Add user message to context (will create thread if needed)
      const userMessageResult = addMessage({
        role: 'user',
        content: userContent
      })

      if (!userMessageResult) {
        setIsLoading(false)
        return
      }

      const threadId = userMessageResult.threadId

      if (!threadId) {
        logger.error('No threadId returned from user message')
        setIsLoading(false)
        return
      }

      logger.info('User message added with threadId', { threadId })

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Delay adding assistant message to show thinking animation first
      const currentThreadId = threadId // Capture in closure

      // Add assistant message after delay
      timeoutRef.current = setTimeout(() => {
        logger.info('Adding assistant message to thread', { threadId: currentThreadId })

        // Ensure thread is active
        switchThread(currentThreadId)

        // Use a small delay to ensure state has updated
        setTimeout(() => {
            // Try adding assistant message after state update
            const assistantMessageResult = addMessage({
              role: 'assistant',
              content: '',
              isStreaming: true
            })

            logger.info('Assistant message result', { assistantMessageResult })

            if (!assistantMessageResult) {
              logger.error('Failed to add assistant message')
              setIsLoading(false)
              return
            }

            const assistantMessageId = assistantMessageResult.messageId
            const assistantThreadId = assistantMessageResult.threadId

            logger.info('Assistant IDs', { assistantMessageId, assistantThreadId })

            // Generate response based on input
            let response = ""

            // Check for specific demo prompts first (exact matches from suggested prompts)
            if (userContent === "What instruments are currently running?") {
              response = `Currently monitoring 5 active instruments:

• **HPLC System A** - Running protocol "Protein_Purification_v2" (45% complete, ~23 min remaining)
• **Mass Spectrometer MS-03** - Idle, last run completed 2 hours ago
• **PCR Thermocycler TC-01** - Running "COVID_Detection_96well" (72% complete, ~8 min remaining)
• **Liquid Handler LH-02** - Preparing samples for next run (queue: 3 protocols)
• **Plate Reader PR-04** - Running ELISA assay (12% complete, ~35 min remaining)

All instruments operating within normal parameters. No errors detected.`
          } else if (userContent === "Generate a QC report for today's runs") {
            response = `# Quality Control Report - ${new Date().toLocaleDateString()}

## Summary Statistics
- **Total Runs Today**: 42
- **Success Rate**: 95.2%
- **Average Runtime**: 1h 23min
- **Samples Processed**: 384

## Instrument Performance
| Instrument | Uptime | Efficiency | Status |
|-----------|---------|------------|---------|
| HPLC-A | 98.5% | 92% | ✅ Optimal |
| MS-03 | 99.1% | 88% | ✅ Optimal |
| TC-01 | 96.2% | 94% | ⚠️ Maintenance due |
| LH-02 | 99.8% | 91% | ✅ Optimal |

## Failed Runs Analysis
- 2 failures due to sample preparation errors
- 1 failure due to power fluctuation at 14:23

## Recommendations
1. Schedule maintenance for TC-01 within next 48 hours
2. Review sample prep protocol for consistency
3. All critical metrics within acceptable range`
          } else if (userContent === "Show recent failed experiments") {
            response = `Found 3 failed experiments in the last 7 days:

1. **EXP-2024-0187** (2 days ago)
   - Protocol: Protein Expression Optimization
   - Failure: Temperature deviation detected at hour 6
   - Root Cause: Incubator cooling system malfunction
   - Action Taken: Maintenance completed, system recalibrated

2. **EXP-2024-0181** (4 days ago)
   - Protocol: qPCR Viral Detection
   - Failure: No amplification in positive controls
   - Root Cause: Expired master mix reagent
   - Action Taken: New reagents ordered and validated

3. **EXP-2024-0175** (6 days ago)
   - Protocol: Cell Culture Expansion
   - Failure: Contamination detected
   - Root Cause: HEPA filter replacement overdue
   - Action Taken: Filter replaced, workspace decontaminated

Would you like detailed logs for any of these experiments?`
          } else if (userContent === "Help optimize ELISA protocol efficiency") {
            response = `Based on your historical ELISA data, here are optimization recommendations:

## Current Protocol Analysis
- Average CV: 12.3% (target: <10%)
- Signal/Background Ratio: 8.5:1
- Time to completion: 4.5 hours

## Optimization Suggestions

### 1. Blocking Buffer Enhancement
Change from 3% BSA to 5% non-fat milk in PBS-T
- Expected improvement: 15% reduction in background
- Validated on similar assays

### 2. Incubation Time Adjustment
- Primary antibody: Reduce from 2h to 1.5h at room temp
- Secondary antibody: Maintain at 1h
- This saves 30 min without signal loss

### 3. Wash Protocol Optimization
- Increase wash cycles from 3x to 5x
- Add 0.1% Tween-20 to wash buffer
- Expected CV improvement: ~3%

### 4. Detection Enhancement
- Switch to TMB Ultra substrate
- 20% signal increase observed in pilot tests

**Estimated new metrics after optimization:**
- CV: <9%
- S/B Ratio: 12:1
- Time: 3.5 hours

Would you like me to generate the updated protocol document?`
          }
          // Fallback to keyword matching for other queries
          else if (userContent.toLowerCase().includes('running') || userContent.toLowerCase().includes('status')) {
            response = "Currently, 2 instruments are running:\n\n• **qPCR System (PCR-001)**: COVID-19 Detection protocol, 23 minutes remaining\n• **MiSeq (SEQ-003)**: 16S rRNA Sequencing, 4 hours 12 minutes remaining\n\nAll other instruments are idle and ready for use."
          } else if (userContent.toLowerCase().includes('elisa')) {
            response = "I'll prepare to start the ELISA protocol on plate reader PR-07. Here's what will happen:\n\n**Protocol**: ELISA_v3\n**Instrument**: PR-07 (Plate Reader)\n**Estimated Duration**: 45 minutes\n**Status**: ✅ Instrument ready\n\nPlease confirm to begin the protocol execution."
          } else if (userContent.toLowerCase().includes('report') || userContent.toLowerCase().includes('qc')) {
            response = "Here's today's qPCR summary:\n\n**Total Runs**: 12\n**Successful**: 10 (83%)\n**Failed**: 2 (17%)\n\n**Failed Tests**:\n1. Sample QC-2341: Ct value out of range (>35)\n2. Sample QC-2355: Negative control contamination detected\n\n**Average Ct Value**: 24.3\n**Total Runtime**: 6 hours 45 minutes\n\nWould you like me to export this report or send it to the QA team?"
          } else if (userContent.toLowerCase().includes('error') || userContent.toLowerCase().includes('maintenance')) {
            response = "I found 2 instruments requiring attention:\n\n**⚠️ Errors (1)**:\n• **HPLC-002**: Pressure sensor fault detected. Last error: 2 hours ago\n\n**🔧 Maintenance Required (1)**:\n• **MS-001**: Scheduled calibration overdue by 3 days\n\nWould you like to create maintenance tickets for these issues?"
          } else {
            // Default response for unmatched queries
            response = `I understand you're asking about: "${userContent}"

I can help you with various lab operations including:
- Monitoring instrument status and runs
- Generating QC and compliance reports
- Troubleshooting failed experiments
- Optimizing protocols for efficiency
- Managing maintenance schedules

How can I assist you with your lab operations today?`
            }

            // Debug logging
            logger.info('Streaming response', {
              threadId: assistantThreadId,
              messageId: assistantMessageId,
              responseLength: response.length,
              responsePreview: response.substring(0, 50)
            })

            // Stream the response immediately
            simulateStreaming(assistantThreadId, assistantMessageId, response).then(() => {
              setIsLoading(false)
            })
        }, 100) // Small delay for state update
      }, 500) // Show thinking for 500ms
    } catch (error) {
      // Error handled internally
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as React.FormEvent)
    }
  }

  // Show loading state
  if (sessionLoading || hasPermission === null) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] md:h-[calc(100vh-0rem)]">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Show permission denied if user doesn't have access
  if (!hasPermission) {
    return (
      <PermissionDenied
        resource="Lab Assistant"
        action="use the Lab Assistant"
        requiredRole={authError?.requiredRole as UserRole | undefined}
        currentRole={user?.roles[0]}
        message={authError?.message}
        onBack={() => router.push('/dashboard')}
      />
    )
  }

  const handleShare = async () => {
    if (!activeThread) return

    // Create shareable content
    const shareContent = messages.map(m =>
      `${m.role === 'user' ? 'You' : 'Assistant'}: ${m.content}`
    ).join('\n\n')

    try {
      await navigator.clipboard.writeText(shareContent)
      // You could show a toast here
    } catch (err) {
      logger.error('Failed to copy', err)
    }
  }

  const handleArchive = () => {
    if (!activeThread) return
    // Archive functionality - you can implement this in the chat context
    setShowMenu(false)
  }

  const handleReport = () => {
    if (!activeThread) return
    // Report functionality
    setShowMenu(false)
  }

  const handleRename = () => {
    if (!activeThread) return
    const newTitle = prompt('Enter new title:', activeThread.title)
    if (newTitle && newTitle !== activeThread.title) {
      renameThread(activeThread.id, newTitle)
    }
    setShowMenu(false)
  }

  const handleDelete = () => {
    if (!activeThread) return
    if (confirm('Are you sure you want to delete this conversation?')) {
      deleteThread(activeThread.id)
      router.push('/assistant')
    }
    setShowMenu(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-0rem)] relative">
      {/* Action buttons when chat is active */}
      {activeThread && messages.length > 0 && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          <Button
            onClick={handleShare}
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg hover:bg-accent"
            title="Share conversation"
          >
            <Share2 className="h-4 w-4" />
          </Button>

          <div className="relative" ref={menuRef}>
            <Button
              onClick={() => setShowMenu(!showMenu)}
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg hover:bg-accent"
              title="More options"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                <button
                  onClick={handleArchive}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent w-full text-left transition-colors"
                >
                  <Archive className="h-4 w-4" />
                  Archive
                </button>
                <button
                  onClick={handleReport}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent w-full text-left transition-colors"
                >
                  <Flag className="h-4 w-4" />
                  Report
                </button>
                <button
                  onClick={handleRename}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent w-full text-left transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                  Rename
                </button>
                <div className="border-t border-border" />
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-destructive/10 text-destructive w-full text-left transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          // Hero Section - When no messages
          <div className="flex flex-col items-center justify-center h-full px-4 py-8">
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <div className="relative bg-muted rounded-full p-3 md:p-4">
                  <Sparkles className="h-6 w-6 md:h-8 md:w-8 text-foreground" />
                </div>
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-semibold text-center mb-2">
              What can I help with?
            </h1>
            <p className="text-sm md:text-base text-muted-foreground text-center mb-8 max-w-2xl px-4">
              Ask me about instrument status, start protocols, generate reports, or get help with lab operations
            </p>

            {/* Suggested Prompts Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-3xl px-2 md:px-0">
              {suggestedPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestedPrompt(prompt.prompt)}
                  className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-left group"
                >
                  <div className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {prompt.icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm mb-1">{prompt.title}</div>
                    <div className="text-xs text-muted-foreground">{prompt.prompt}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Messages Thread
          <div className="max-w-3xl mx-auto w-full px-3 md:px-4 py-6 md:py-8">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "mb-4 md:mb-6 flex gap-3 md:gap-4",
                  message.role === 'user' ? 'flex-row-reverse' : ''
                )}
              >
                {/* Avatar */}
                <div className={cn(
                  "flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-sm font-medium",
                  message.role === 'user'
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}>
                  {message.role === 'user' ? 'Y' : <Sparkles className="h-3 w-3 md:h-4 md:w-4 text-foreground" />}
                </div>

                {/* Message Content */}
                <div className={cn(
                  "flex-1 space-y-2 min-w-0",
                  message.role === 'user' ? 'text-right' : ''
                )}>
                  <div className={cn(
                    "inline-block px-3 md:px-4 py-2 rounded-2xl max-w-[85%] md:max-w-full text-sm relative",
                    message.role === 'user'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}>
                    <SafeMessageContent
                      content={message.containsPHI || message.containsPII ? message.redactedContent || message.content : message.content}
                      isStreaming={message.isStreaming}
                      renderMarkdown={message.role === 'assistant'}
                    />
                  </div>
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3 md:gap-4 mb-4 md:mb-6">
                <div className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-muted flex items-center justify-center">
                  <Sparkles className="h-3 w-3 md:h-4 md:w-4 text-foreground animate-pulse" />
                </div>
                <div className="flex items-center gap-1.5 px-3 md:px-4 py-2 bg-muted rounded-2xl">
                  <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto w-full p-3 md:p-4">
          <div className="relative flex items-end gap-2 bg-muted rounded-xl md:rounded-2xl px-3 md:px-4 py-2 shadow-sm transition-shadow focus-within:shadow-md">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isLoading ? "Lab Assistant is thinking..." : "Ask anything..."}
              className="flex-1 bg-transparent resize-none outline-none min-h-[24px] max-h-[200px] py-1 text-sm md:text-base placeholder:text-muted-foreground transition-opacity"
              rows={1}
              disabled={isLoading}
              style={{ opacity: isLoading ? 0.5 : 1 }}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className={cn(
                "rounded-lg md:rounded-xl h-8 w-8 flex-shrink-0 transition-all",
                isLoading && "opacity-50 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <div className="h-4 w-4 border-2 border-current/20 border-t-current rounded-full animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="text-center mt-2">
            <p className="text-[10px] md:text-xs text-muted-foreground">
              Lab Assistant can make mistakes. Verify critical operations before execution.
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

// Wrap the component with error boundary
export default function AssistantPage() {
  return (
    <ChatErrorBoundary>
      <AssistantPageContent />
    </ChatErrorBoundary>
  )
}