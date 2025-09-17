'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  isStreaming?: boolean
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

  // Thread operations
  createThread: (title?: string) => string
  deleteThread: (id: string) => void
  renameThread: (id: string, newTitle: string) => void
  switchThread: (id: string) => void

  // Message operations
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => { messageId: string; threadId: string } | null
  updateMessage: (threadId: string, messageId: string, content: string, isStreaming?: boolean) => void
  clearThread: (threadId: string) => void

  // Search
  searchThreads: (query: string) => ChatThread[]

  // Persistence
  saveToLocalStorage: () => void
  loadFromLocalStorage: () => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

const STORAGE_KEY = 'antevus-chat-threads'

export function ChatProvider({ children }: { children: ReactNode }) {
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const creatingThreadRef = useRef(false)
  const pendingThreadIdRef = useRef<string | null>(null)

  // Load threads from localStorage on mount
  useEffect(() => {
    loadFromLocalStorage()
  }, [])

  // Save to localStorage whenever threads change
  useEffect(() => {
    if (threads.length > 0) {
      saveToLocalStorage()
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
    return newThread.id
  }

  const deleteThread = (id: string) => {
    setThreads(prev => prev.filter(t => t.id !== id))

    // If we're deleting the active thread, switch to the next available
    if (activeThreadId === id) {
      const remainingThreads = threads.filter(t => t.id !== id)
      setActiveThreadId(remainingThreads.length > 0 ? remainingThreads[0].id : null)
    }
  }

  const renameThread = (id: string, newTitle: string) => {
    setThreads(prev => prev.map(thread =>
      thread.id === id
        ? { ...thread, title: newTitle, updatedAt: new Date() }
        : thread
    ))
  }

  const switchThread = (id: string) => {
    // Allow empty string to clear active thread
    setActiveThreadId(id || null)
  }

  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date()
    }

    // Check for pending thread ID first (from recent user message)
    let threadIdToUse = activeThreadId || pendingThreadIdRef.current

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

        setThreads(prev => [newThread, ...prev])
        setActiveThreadId(newThreadId)
        pendingThreadIdRef.current = newThreadId // Store in ref immediately
        threadIdToUse = newThreadId

        // Reset the flags after state has updated
        setTimeout(() => {
          creatingThreadRef.current = false
          pendingThreadIdRef.current = null
        }, 500)

        return { messageId: newMessage.id, threadId: newThreadId }
      } else {
        // Assistant message with no thread - shouldn't happen
        console.warn('Attempted to add assistant message with no active thread')
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

    return { messageId: newMessage.id, threadId: threadIdToUse! }
  }

  const updateMessage = (threadId: string, messageId: string, content: string, isStreaming?: boolean) => {
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
  }

  const clearThread = (threadId: string) => {
    setThreads(prev => prev.map(thread =>
      thread.id === threadId
        ? { ...thread, messages: [], updatedAt: new Date() }
        : thread
    ))
  }

  const searchThreads = (query: string): ChatThread[] => {
    const lowerQuery = query.toLowerCase()
    return threads.filter(thread =>
      thread.title.toLowerCase().includes(lowerQuery) ||
      thread.messages.some(msg => msg.content.toLowerCase().includes(lowerQuery))
    )
  }

  const saveToLocalStorage = () => {
    try {
      const dataToSave = {
        threads: threads.map(thread => ({
          ...thread,
          messages: thread.messages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp.toISOString()
          })),
          createdAt: thread.createdAt.toISOString(),
          updatedAt: thread.updatedAt.toISOString()
        })),
        activeThreadId
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave))
    } catch (error) {
      console.error('Failed to save chat threads:', error)
    }
  }

  const loadFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        const loadedThreads = parsed.threads.map((thread: {
          id: string
          title: string
          messages: Array<{
            id: string
            role: 'user' | 'assistant' | 'system'
            content: string
            timestamp: string
            isStreaming?: boolean
          }>
          createdAt: string
          updatedAt: string
        }) => ({
          ...thread,
          messages: thread.messages.map((msg) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          })),
          createdAt: new Date(thread.createdAt),
          updatedAt: new Date(thread.updatedAt)
        }))
        setThreads(loadedThreads)
        setActiveThreadId(parsed.activeThreadId)
      }
    } catch (error) {
      console.error('Failed to load chat threads:', error)
    }
  }

  const contextValue: ChatContextType = {
    threads,
    activeThreadId,
    activeThread,
    createThread,
    deleteThread,
    renameThread,
    switchThread,
    addMessage,
    updateMessage,
    clearThread,
    searchThreads,
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