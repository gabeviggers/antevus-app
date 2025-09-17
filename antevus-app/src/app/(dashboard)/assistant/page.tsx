'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Send, Sparkles, Beaker, Activity, FileText, AlertCircle, ArrowLeft, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useChat } from '@/contexts/chat-context'

interface SuggestedPrompt {
  icon: React.ReactNode
  title: string
  prompt: string
}

export default function AssistantPage() {
  const { activeThread, addMessage, updateMessage, switchThread } = useChat()
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const currentThreadIdRef = useRef<string | null>(null)

  // Use activeThread messages directly, no local state
  const messages = useMemo(() => activeThread?.messages || [], [activeThread?.messages])

  // Track the current thread ID
  useEffect(() => {
    currentThreadIdRef.current = activeThread?.id || null
  }, [activeThread?.id])

  const handleNewChat = () => {
    switchThread('') // Clear active thread
    setInput('')
    setIsLoading(false)
  }

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

    for (let i = 0; i < words.length; i++) {
      currentText += (i === 0 ? '' : ' ') + words[i]
      const isStreaming = i < words.length - 1

      updateMessage(threadId, messageId, currentText, isStreaming)
      await new Promise(resolve => setTimeout(resolve, 30))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userContent = input.trim()
    setInput('')
    setIsLoading(true)

    try {
      // Add user message to context (will create thread if needed)
      const userMessageResult = addMessage({
        role: 'user',
        content: userContent
      })

      const threadId = userMessageResult?.threadId

      // Wait for state to update with new thread
      setTimeout(async () => {
        // Add empty assistant message first (thinking state) and get its ID
        const assistantMessageResult = addMessage({
          role: 'assistant',
          content: '',
          isStreaming: true
        })

        if (!threadId || !assistantMessageResult) {
          console.error('No thread or assistant message available')
          setIsLoading(false)
          return
        }

        const assistantMessageId = assistantMessageResult.messageId

        // Generate response based on input
        let response = "I'll help you with that request. "

        if (userContent.toLowerCase().includes('running') || userContent.toLowerCase().includes('status')) {
          response = "Currently, 2 instruments are running:\n\n• **qPCR System (PCR-001)**: COVID-19 Detection protocol, 23 minutes remaining\n• **MiSeq (SEQ-003)**: 16S rRNA Sequencing, 4 hours 12 minutes remaining\n\nAll other instruments are idle and ready for use."
        } else if (userContent.toLowerCase().includes('elisa')) {
          response = "I'll prepare to start the ELISA protocol on plate reader PR-07. Here's what will happen:\n\n**Protocol**: ELISA_v3\n**Instrument**: PR-07 (Plate Reader)\n**Estimated Duration**: 45 minutes\n**Status**: ✅ Instrument ready\n\nPlease confirm to begin the protocol execution."
        } else if (userContent.toLowerCase().includes('report') || userContent.toLowerCase().includes('summarize')) {
          response = "Here's today's qPCR summary:\n\n**Total Runs**: 12\n**Successful**: 10 (83%)\n**Failed**: 2 (17%)\n\n**Failed Tests**:\n1. Sample QC-2341: Ct value out of range (>35)\n2. Sample QC-2355: Negative control contamination detected\n\n**Average Ct Value**: 24.3\n**Total Runtime**: 6 hours 45 minutes\n\nWould you like me to export this report or send it to the QA team?"
        } else if (userContent.toLowerCase().includes('error') || userContent.toLowerCase().includes('maintenance')) {
          response = "I found 2 instruments requiring attention:\n\n**⚠️ Errors (1)**:\n• **HPLC-002**: Pressure sensor fault detected. Last error: 2 hours ago\n\n**🔧 Maintenance Required (1)**:\n• **MS-001**: Scheduled calibration overdue by 3 days\n\nWould you like to create maintenance tickets for these issues?"
        }

        // Wait a moment then stream the response
        setTimeout(async () => {
          await simulateStreaming(threadId, assistantMessageId, response)
          setIsLoading(false)
        }, 500)
      }, 150) // Delay to ensure thread is created
    } catch (error) {
      console.error('Failed to submit message:', error)
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as React.FormEvent)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-0rem)]">
      {/* Header with thread info when chat is active */}
      {activeThread && messages.length > 0 && (
        <div className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center h-full gap-3 px-3 md:px-4">
            <Button
              onClick={handleNewChat}
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-2 flex-1 min-w-0">
              <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium text-foreground truncate">
                {activeThread.title}
              </span>
            </div>

            <span className="text-xs text-muted-foreground hidden sm:block">
              {activeThread.messages.length} message{activeThread.messages.length !== 1 ? 's' : ''}
            </span>
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
                    "inline-block px-3 md:px-4 py-2 rounded-2xl max-w-[85%] md:max-w-full text-sm",
                    message.role === 'user'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}>
                    <div className="whitespace-pre-wrap break-words">
                      {message.content}
                      {message.isStreaming && (
                        <span className="inline-block w-1 h-4 ml-1 bg-current animate-pulse" />
                      )}
                    </div>
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
      <div className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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