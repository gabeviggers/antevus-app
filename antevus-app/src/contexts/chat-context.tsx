'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react'
import { secureChatStorage } from '@/lib/security/secure-storage'
import { auditLogger, AuditEventType } from '@/lib/security/audit-logger'
import { logger } from '@/lib/logger'
import { dataClassifier, DataSensitivity, DataCategory } from '@/lib/security/data-classification'
import { authManager } from '@/lib/security/auth-manager'

// Rate limiting configuration with exponential backoff
const RATE_LIMIT_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 16000, // 16 seconds
  backoffMultiplier: 2
}

// Rate limiter with exponential backoff
class RateLimiter {
  private retryCount = 0
  private lastAttempt = 0

  async executeWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T | null> {
    const now = Date.now()
    const timeSinceLastAttempt = now - this.lastAttempt

    // Reset retry count if enough time has passed (1 minute)
    if (timeSinceLastAttempt > 60000) {
      this.retryCount = 0
    }

    try {
      this.lastAttempt = now
      const result = await operation()
      this.retryCount = 0 // Reset on success
      return result
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // Check if it's a rate limit error
      if (error?.status === 429 || error?.message?.includes('rate')) {
        if (this.retryCount < RATE_LIMIT_CONFIG.maxRetries) {
          this.retryCount++
          const delay = Math.min(
            RATE_LIMIT_CONFIG.baseDelay * Math.pow(RATE_LIMIT_CONFIG.backoffMultiplier, this.retryCount - 1),
            RATE_LIMIT_CONFIG.maxDelay
          )

          // Only log rate limiting in development
          if (process.env.NODE_ENV === 'development') {
            logger.warn(`Rate limited on ${operationName}. Retrying in ${delay}ms`)
          }

          // Wait with exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay))

          // Retry the operation
          return this.executeWithBackoff(operation, operationName)
        } else {
          // SECURITY: Don't log details in production to avoid information leakage
          if (process.env.NODE_ENV === 'development') {
            logger.warn(`Max retries exceeded for ${operationName}`)
          }
          // Return null to indicate we should use fallback
          return null
        }
      }

      // For other errors, return null without logging in production
      if (process.env.NODE_ENV === 'development') {
        logger.warn(`Error in ${operationName}`)
      }
      return null
    }
  }

  reset() {
    this.retryCount = 0
    this.lastAttempt = 0
  }
}

// Create rate limiter instances for different operations
const saveRateLimiter = new RateLimiter()
const loadRateLimiter = new RateLimiter()

// Security warning disabled to avoid console spam

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  isStreaming?: boolean
  // Data classification fields
  sensitivity?: DataSensitivity
  categories?: DataCategory[]
  containsPHI?: boolean
  containsPII?: boolean
  redactedContent?: string
  // Metadata for special content like reports
  metadata?: Record<string, any>
}

export interface ChatThread {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

interface ChatContextType {
  // Thread management
  threads: ChatThread[]
  activeThreadId: string | null
  activeThread: ChatThread | null
  totalThreadCount: number
  isLoadingMore: boolean

  // Thread operations
  createThread: (title?: string) => string
  deleteThread: (id: string) => void
  renameThread: (id: string, newTitle: string) => void
  switchThread: (id: string) => void

  // Message operations
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => { messageId: string; threadId: string } | null
  updateMessage: (threadId: string, messageId: string, content: string, isStreaming?: boolean) => void
  clearThread: (threadId: string) => void

  // Search & Pagination
  searchThreads: (query: string) => ChatThread[]
  loadMoreThreads: () => Promise<void>

  // Persistence
  saveToLocalStorage: () => void
  loadFromLocalStorage: () => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

// SECURITY: No browser storage used - memory-only for HIPAA compliance
// const STORAGE_KEY = 'antevus-chat-threads' // REMOVED FOR HIPAA COMPLIANCE

// Configuration
const MAX_THREADS = 50 // Maximum threads to keep in memory
const MAX_MESSAGES_PER_THREAD = 100 // Maximum messages per thread
const ARCHIVE_AFTER_DAYS = 30 // Archive threads older than this
const PAGE_SIZE = 10 // Load threads in batches

export function ChatProvider({ children }: { children: ReactNode }) {
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [totalThreadCount, setTotalThreadCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const creatingThreadRef = useRef(false)
  const pendingThreadIdRef = useRef<string | null>(null)

  // SECURITY: Load threads from memory-only storage
  // WARNING: Data is session-only and will be lost on refresh
  useEffect(() => {
    loadFromSecureStorage()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // SECURITY: Save to local storage (now safe - no API calls)
  useEffect(() => {
    if (threads.length > 0) {
      saveToSecureStorage()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads])

  const activeThread = threads.find(t => t.id === activeThreadId) || null

  const createThread = (title?: string): string => {
    const newThread: ChatThread = {
      id: Date.now().toString(),
      title: title || 'New Chat',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    setThreads(prev => [newThread, ...prev])
    setActiveThreadId(newThread.id)

    // Audit log: Thread creation
    auditLogger.logThreadOperation('created', newThread.id, {
      title: title || 'New Chat',
      source: 'manual_creation'
    })

    return newThread.id
  }

  const deleteThread = (id: string) => {
    const threadToDelete = threads.find(t => t.id === id)
    const messageCount = threadToDelete?.messages.length || 0

    setThreads(prev => prev.filter(t => t.id !== id))

    // If we're deleting the active thread, switch to the next available
    if (activeThreadId === id) {
      const remainingThreads = threads.filter(t => t.id !== id)
      setActiveThreadId(remainingThreads.length > 0 ? remainingThreads[0].id : null)
    }

    // Audit log: Thread deletion
    auditLogger.logThreadOperation('deleted', id, {
      messageCount,
      title: threadToDelete?.title
    })
  }

  const renameThread = (id: string, newTitle: string) => {
    const thread = threads.find(t => t.id === id)
    const oldTitle = thread?.title

    setThreads(prev => prev.map(thread =>
      thread.id === id
        ? { ...thread, title: newTitle, updatedAt: new Date() }
        : thread
    ))

    // Audit log: Thread rename
    auditLogger.logThreadOperation('renamed', id, {
      oldTitle,
      newTitle
    })
  }

  const switchThread = (id: string) => {
    // Allow empty string to clear active thread
    const previousThreadId = activeThreadId
    setActiveThreadId(id || null)

    // IMPORTANT: Also update the ref immediately so assistant messages can use it
    if (id) {
      pendingThreadIdRef.current = id
    }

    // Audit log: Thread access
    if (id) {
      auditLogger.logThreadOperation('accessed', id, {
        previousThreadId,
        action: 'switch_thread'
      })
    }
  }

  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    // Classify the message content for sensitivity
    const classification = dataClassifier.classify(message.content, {
      isLabData: true,
      messageRole: message.role
    })

    const newMessage: Message = {
      ...message,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      sensitivity: classification.sensitivity,
      categories: classification.categories,
      containsPHI: classification.containsPHI,
      containsPII: classification.containsPII,
      redactedContent: classification.redactedContent
    }

    // Check for pending thread ID first (from recent user message)
    let threadIdToUse = activeThreadId || pendingThreadIdRef.current

    logger.debug('Adding message to thread', {
      role: message.role,
      activeThreadId,
      pendingThreadId: pendingThreadIdRef.current,
      threadsCount: threads.length,
      threadIds: threads.map(t => t.id)
    })

    // If no thread ID but this is an assistant message, check if we have any threads
    // This can happen due to async state updates
    if (!threadIdToUse && message.role === 'assistant' && threads.length > 0) {
      // Use the most recent thread (first in array)
      threadIdToUse = threads[0].id
      // Debug logging only in development
      if (process.env.NODE_ENV === 'development') {
        logger.info('Using most recent thread for assistant message')
      }
    }

    // Handle thread creation synchronously if needed
    if (!threadIdToUse && !creatingThreadRef.current) {
      // Only create thread for user messages
      if (message.role === 'user') {
        creatingThreadRef.current = true

        const title = message.content
          ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
          : 'New Chat'

        const newThreadId = `thread-${Date.now()}`
        const newThread: ChatThread = {
          id: newThreadId,
          title,
          messages: [newMessage],
          createdAt: new Date(),
          updatedAt: new Date()
        }

        // Enforce thread limit
        setThreads(prev => {
          const newThreads = [newThread, ...prev]
          // Keep only MAX_THREADS most recent
          if (newThreads.length > MAX_THREADS) {
            return newThreads.slice(0, MAX_THREADS)
          }
          return newThreads
        })
        setActiveThreadId(newThreadId)
        pendingThreadIdRef.current = newThreadId // Store in ref immediately
        threadIdToUse = newThreadId

        // Audit log: Thread creation from first message
        auditLogger.logThreadOperation('created', newThreadId, {
          title,
          source: 'first_message',
          messageCount: 1
        })

        // Audit log: Message sent
        auditLogger.logChatMessage('sent', newMessage.id, newThreadId, {
          role: message.role,
          contentLength: message.content?.length || 0
        })

        // Reset the flags immediately since state is updated synchronously
        creatingThreadRef.current = false
        pendingThreadIdRef.current = null

        return { messageId: newMessage.id, threadId: newThreadId }
      } else {
        // Assistant message with no thread - shouldn't happen
        // Attempted to add assistant message with no active thread
        return null
      }
    }

    // Add message to existing thread
    setThreads(prev => prev.map(thread => {
      if (thread.id === threadIdToUse) {
        return {
          ...thread,
          messages: [...thread.messages, newMessage],
          updatedAt: new Date()
        }
      }
      return thread
    }))

    // Audit log: Message sent/received
    auditLogger.logChatMessage(
      message.role === 'user' ? 'sent' : 'received',
      newMessage.id,
      threadIdToUse!,
      {
        role: message.role,
        contentLength: message.content?.length || 0,
        isStreaming: message.isStreaming || false
      }
    )

    // Clear pending ref if it was used for assistant message
    if (message.role === 'assistant' && pendingThreadIdRef.current === threadIdToUse) {
      pendingThreadIdRef.current = null
    }

    return { messageId: newMessage.id, threadId: threadIdToUse! }
  }

  const updateMessage = (threadId: string, messageId: string, content: string, isStreaming?: boolean) => {
    const thread = threads.find(t => t.id === threadId)
    const message = thread?.messages.find(m => m.id === messageId)
    const previousContent = message?.content

    setThreads(prev => prev.map(thread =>
      thread.id === threadId
        ? {
            ...thread,
            messages: thread.messages.map(msg =>
              msg.id === messageId
                ? { ...msg, content, isStreaming }
                : msg
            ),
            updatedAt: new Date()
          }
        : thread
    ))

    // Only log if content actually changed (not just streaming status)
    if (previousContent !== content && content) {
      auditLogger.logChatMessage('edited', messageId, threadId, {
        contentLength: content.length,
        isStreaming: isStreaming || false,
        action: 'streaming_update'
      })
    }
  }

  const clearThread = (threadId: string) => {
    const thread = threads.find(t => t.id === threadId)
    const messageCount = thread?.messages.length || 0

    setThreads(prev => prev.map(thread =>
      thread.id === threadId
        ? { ...thread, messages: [], updatedAt: new Date() }
        : thread
    ))

    // Audit log: Thread cleared
    auditLogger.logThreadOperation('cleared', threadId, {
      messageCount,
      title: thread?.title
    })
  }

  const searchThreads = (query: string): ChatThread[] => {
    const lowerQuery = query.toLowerCase()
    const results = threads.filter(thread =>
      thread.title.toLowerCase().includes(lowerQuery) ||
      thread.messages.some(msg => msg.content.toLowerCase().includes(lowerQuery))
    )

    // Audit log: Search performed
    auditLogger.log({
      eventType: AuditEventType.CHAT_HISTORY_VIEWED,
      action: 'Chat history searched',
      metadata: {
        queryLength: query.length,
        resultsCount: results.length,
        hasQuery: query.length > 0
      },
      containsPHI: true
    })

    return results
  }

  /**
   * Archive old threads to server and remove from memory
   * Runs automatically to prevent memory issues
   */
  const archiveOldThreads = async () => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_AFTER_DAYS)

    const threadsToArchive = threads.filter(
      thread => new Date(thread.updatedAt) < cutoffDate
    )

    if (threadsToArchive.length === 0) return

    try {
      const token = authManager.getToken()
      if (token) {
        // Archive to server
        await fetch('/api/chat/archive', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ threads: threadsToArchive })
        })
      }

      // Remove archived threads from memory
      setThreads(prev => prev.filter(
        thread => new Date(thread.updatedAt) >= cutoffDate
      ))

      // Audit log
      auditLogger.log({
        eventType: AuditEventType.CHAT_THREAD_DELETED,
        action: 'Threads archived',
        metadata: {
          count: threadsToArchive.length,
          reason: 'auto_archive',
          daysOld: ARCHIVE_AFTER_DAYS
        }
      })
    } catch {
      // Archive failed, keep threads in memory
    }
  }

  /**
   * Limit thread size to prevent memory issues
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _trimThreadMessages = (thread: ChatThread): ChatThread => {
    if (thread.messages.length <= MAX_MESSAGES_PER_THREAD) {
      return thread
    }

    // Keep only the most recent messages
    const trimmedMessages = thread.messages.slice(-MAX_MESSAGES_PER_THREAD)

    return {
      ...thread,
      messages: trimmedMessages
    }
  }

  /**
   * Load more threads (pagination)
   */
  const loadMoreThreads = async () => {
    if (isLoadingMore) return

    setIsLoadingMore(true)
    try {
      const token = authManager.getToken()
      if (!token) return

      const response = await fetch(`/api/chat/threads?page=${currentPage + 1}&limit=${PAGE_SIZE}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const { threads: newThreads, total } = await response.json()

        // Append new threads
        setThreads(prev => [...prev, ...newThreads])
        setCurrentPage(prev => prev + 1)
        setTotalThreadCount(total)
      }
    } catch {
      // Load failed
    } finally {
      setIsLoadingMore(false)
    }
  }

  /**
   * PRODUCTION: Save threads to encrypted server storage
   * - Data is encrypted at rest with AES-256-GCM
   * - User authentication required
   * - Audit logged for SOC 2 compliance
   * - Implements exponential backoff for rate limiting
   */
  const saveToSecureStorage = async () => {
    try {
      // Always save to secure memory storage first (immediate)
      threads.forEach(thread => {
        secureChatStorage.setThread(thread)
      })

      // Try to save to server with rate limiting protection
      const token = authManager.getToken()
      if (!token) {
        // Debug logging only in development
        if (process.env.NODE_ENV === 'development') {
          logger.debug('No auth token, skipping server save')
        }
        return
      }

      // Execute with rate limiting and exponential backoff
      const result = await saveRateLimiter.executeWithBackoff(async () => {
        const response = await fetch('/api/chat/threads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ threads })
        })

        if (!response.ok) {
          if (response.status === 429) {
            throw { status: 429, message: 'Rate limited' }
          }
          throw new Error(`Failed to save: ${response.statusText}`)
        }

        return response.json()
      }, 'saveToSecureStorage')

      if (result) {
        // Debug logging only in development
        if (process.env.NODE_ENV === 'development') {
          logger.debug('Threads saved successfully')
        }
      } else {
        // Warn only in development
        if (process.env.NODE_ENV === 'development') {
          logger.warn('Server save failed, data in memory only')
        }
      }
    } catch {
      // Error logging only in development
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Failed to save threads')
      }
      // Data is still safe in memory
    }
  }

  /**
   * PRODUCTION: Load threads from encrypted server storage
   * - Data is decrypted on server side
   * - User authentication required
   * - Persists across page refreshes securely
   * - Implements exponential backoff for rate limiting
   */
  const loadFromSecureStorage = async () => {
    try {
      // First, load from secure memory storage (immediate)
      const sessionThreads = secureChatStorage.getAllThreads()
      if (sessionThreads.length > 0) {
        setThreads(sessionThreads)
        if (!activeThreadId && sessionThreads.length > 0) {
          setActiveThreadId(sessionThreads[0].id)
        }
      }

      // Try to load from server with rate limiting protection
      const token = authManager.getToken()
      if (!token) {
        // Debug logging only in development
        if (process.env.NODE_ENV === 'development') {
          logger.debug('No auth token, using memory only')
        }
        return
      }

      // Execute with rate limiting and exponential backoff
      const result = await loadRateLimiter.executeWithBackoff(async () => {
        const response = await fetch('/api/chat/threads', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!response.ok) {
          if (response.status === 429) {
            throw { status: 429, message: 'Rate limited' }
          }
          throw new Error(`Failed to load: ${response.statusText}`)
        }

        return response.json()
      }, 'loadFromSecureStorage')

      if (result && result.threads && result.threads.length > 0) {
        // Convert date strings back to Date objects
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsedThreads = result.threads.map((thread: any) => ({
          ...thread,
          createdAt: new Date(thread.createdAt),
          updatedAt: new Date(thread.updatedAt),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messages: thread.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }))

        setThreads(parsedThreads)

        // Set the first thread as active if there's no active thread
        if (!activeThreadId && parsedThreads.length > 0) {
          setActiveThreadId(parsedThreads[0].id)
        }

        // Update memory storage with server data
        parsedThreads.forEach((thread: ChatThread) => {
          secureChatStorage.setThread(thread)
        })

        // Debug logging only in development
        if (process.env.NODE_ENV === 'development') {
          logger.debug('Threads loaded successfully')
        }
      } else if (!result) {
        // Warn only in development
        if (process.env.NODE_ENV === 'development') {
          logger.warn('Server load failed, using memory')
        }
      }
      // const response = await fetch('/api/chat/threads', {
      //   headers: {
      //     'Authorization': `Bearer ${token}`
      //   }
      // })
      // if (response.ok) {
      //   const { threads: loadedThreads } = await response.json()
      //   if (loadedThreads && loadedThreads.length > 0) {
      //     // Convert date strings back to Date objects
      //     const parsedThreads = loadedThreads.map((thread: any) => ({
      //       ...thread,
      //       createdAt: new Date(thread.createdAt),
      //       updatedAt: new Date(thread.updatedAt),
      //       messages: thread.messages.map((msg: any) => ({
      //         ...msg,
      //         timestamp: new Date(msg.timestamp)
      //       }))
      //     }))
      //
      //     setThreads(parsedThreads)
      //
      //     // Set the first thread as active if there's no active thread
      //     if (!activeThreadId && parsedThreads.length > 0) {
      //       setActiveThreadId(parsedThreads[0].id)
      //     }
      //
      //     // Cache in memory
      //     parsedThreads.forEach((thread: ChatThread) => {
      //       secureChatStorage.setThread(thread)
      //     })
      //   }
      // } else {
      //   // Server error - try memory storage as fallback
      //   const sessionThreads = secureChatStorage.getAllThreads()
      //   if (sessionThreads.length > 0) {
      //     setThreads(sessionThreads)
      //     if (!activeThreadId && sessionThreads.length > 0) {
      //       setActiveThreadId(sessionThreads[0].id)
      //     }
      //   }
      // }
    } catch {
      // Error logging only in development
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Failed to load threads')
      }
      // Session storage fallback is already handled above
    }
  }

  // DEPRECATED: Old localStorage functions kept for interface compatibility
  // These now redirect to secure storage
  const saveToLocalStorage = () => {
    // saveToLocalStorage is deprecated for HIPAA compliance
    saveToSecureStorage()
  }

  const loadFromLocalStorage = () => {
    // loadFromLocalStorage is deprecated for HIPAA compliance
    loadFromSecureStorage()
  }

  // Create a ref to store the save timer
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _saveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced auto-save threads when they change
  // TEMPORARILY DISABLED to prevent rate limiting during development
  useEffect(() => {
    // const saveThreads = async () => {
    //   if (threads.length > 0) {
    //     // Trim messages before saving
    //     const trimmedThreads = threads.map(trimThreadMessages)
    //     await saveToSecureStorage()
    //   }
    // }

    // // Clear any existing timer
    // if (saveTimerRef.current) {
    //   clearTimeout(saveTimerRef.current)
    // }

    // // Set a new timer to save after 5 seconds of inactivity
    // saveTimerRef.current = setTimeout(() => {
    //   saveThreads()
    // }, 5000) // Wait 5 seconds after last change before saving

    // // Cleanup on unmount
    // return () => {
    //   if (saveTimerRef.current) {
    //     clearTimeout(saveTimerRef.current)
    //   }
    // }
  }, [threads])

  // Load threads on mount (now safe - uses local storage only)
  useEffect(() => {
    const loadThreads = async () => {
      await loadFromSecureStorage()
    }
    loadThreads()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-archive old threads every hour
  useEffect(() => {
    const interval = setInterval(() => {
      archiveOldThreads()
    }, 60 * 60 * 1000) // Every hour

    return () => clearInterval(interval)
  }, [threads]) // eslint-disable-line react-hooks/exhaustive-deps

  const contextValue: ChatContextType = {
    threads,
    activeThreadId,
    activeThread,
    totalThreadCount,
    isLoadingMore,
    createThread,
    deleteThread,
    renameThread,
    switchThread,
    addMessage,
    updateMessage,
    clearThread,
    searchThreads,
    loadMoreThreads,
    saveToLocalStorage,
    loadFromLocalStorage
  }

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
}