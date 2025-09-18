'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from '@/contexts/session-context'
import { useChat } from '@/contexts/chat-context'
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { UserRole } from '@/lib/security/authorization'
import {
  LayoutDashboard,
  Activity,
  History,
  Plug,
  Code2,
  Settings,
  LogOut,
  ChevronLeft,
  X,
  Menu,
  Sparkles,
  Search,
  Plus,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
  Trash
} from 'lucide-react'

// Base navigation items available to all users
const baseNavigation = [
  { name: 'Instruments', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Run History', href: '/runs', icon: History },
  { name: 'Monitoring', href: '/monitoring', icon: Activity },
  { name: 'Integrations', href: '/integrations', icon: Plug },
  { name: 'API Playground', href: '/api-playground', icon: Code2 },
]

// Assistant navigation item - only for users with permission
const assistantNavItem = { name: 'Ask Antevus', href: '/assistant', icon: Sparkles }

interface SidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

export function Sidebar({ sidebarOpen, setSidebarOpen, collapsed, setCollapsed }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { logout, user } = useSession()
  const { threads, activeThreadId, switchThread, deleteThread, renameThread, searchThreads } = useChat()
  const [searchQuery, setSearchQuery] = useState('')
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [menuOpenThreadId, setMenuOpenThreadId] = useState<string | null>(null)

  // Determine if user has access to Ask Antevus (everyone except VIEWER and GUEST)
  const hasAssistantAccess = useMemo(() => {
    if (!user?.roles) return false
    const restrictedRoles = [UserRole.VIEWER, UserRole.GUEST]
    return !user.roles.some(role => restrictedRoles.includes(role))
  }, [user?.roles])

  // Build navigation based on user permissions
  const navigation = useMemo(() => {
    if (hasAssistantAccess) {
      // Put Ask Antevus at the top for users with access
      return [assistantNavItem, ...baseNavigation]
    }
    // Just show base navigation for viewers/guests
    return baseNavigation
  }, [hasAssistantAccess])

  // Check if we're on the assistant page
  const isAssistantPage = pathname === '/assistant'

  // Find the most specific active route
  // This prevents parent routes from being active when on child routes
  const activeHref = navigation
    .map(item => item.href)
    .filter(href => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0] || null

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        id="primary-sidebar"
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-50 flex flex-col h-screen bg-card border-r border-border transition-all duration-300 lg:translate-x-0 ${
          collapsed ? 'w-16' : 'w-52'
        }`}
      >
        {/* Logo Section */}
        <div className="h-16 px-4 border-b border-border">
          {collapsed ? (
            // Collapsed state - show hamburger menu button
            <div className="h-full flex items-center justify-center">
              <button
                onClick={() => setCollapsed(false)}
                className="p-2 rounded-md hover:bg-accent transition-colors"
                aria-label="Expand sidebar"
                aria-controls="primary-sidebar"
                aria-expanded={false}
                title="Expand sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          ) : (
            // Expanded state - show logo and close button
            <div className="h-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-600 dark:text-gray-400"
                >
                  <path d="M4.5 3h15" />
                  <path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3" />
                  <path d="M6 14h12" />
                </svg>
                <span className="text-lg font-bold">Antevus</span>
              </div>
              <div className="flex items-center gap-1">
                {/* Desktop collapse button */}
                <button
                  onClick={() => setCollapsed(true)}
                  className="hidden lg:block p-1.5 rounded-md hover:bg-accent transition-colors"
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                  aria-controls="primary-sidebar"
                  aria-expanded={!collapsed}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {/* Mobile close button */}
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden p-1.5 rounded-md hover:bg-accent transition-colors"
                  aria-label="Close sidebar"
                  aria-controls="primary-sidebar"
                  aria-expanded={false}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto py-4">
            <ul className="px-2 space-y-1">
            {navigation.map((item) => {
              const isActive = item.href === activeHref
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={() => {
                      // When clicking Lab Assistant, clear active thread for fresh chat
                      if (item.href === '/assistant') {
                        switchThread('')
                      }
                    }}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group relative ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent hover:text-accent-foreground'
                    } ${collapsed ? 'justify-center' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    title={collapsed ? item.name : undefined}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && (
                      <span className="text-sm font-medium">{item.name}</span>
                    )}
                    {collapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg">
                        {item.name}
                      </div>
                    )}
                  </Link>
                </li>
              )
            })}
            </ul>

            {/* Chat History Section - Only show for users with assistant access */}
            {!collapsed && hasAssistantAccess && (
              <div className="mt-6 px-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chat History</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        // Clear active thread to show fresh chat interface
                        // Thread will be created when user sends first message
                        switchThread('')  // Clear active thread
                        router.push('/assistant')
                      }}
                      className="p-1 rounded hover:bg-accent transition-colors"
                      title="New chat"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    {threads.length > 0 && (
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete all chat history? This cannot be undone.')) {
                            // Delete all threads one by one using secure method
                            threads.forEach(thread => deleteThread(thread.id))
                            // Navigate to assistant page to show fresh interface
                            router.push('/assistant')
                          }
                        }}
                        className="p-1 rounded hover:bg-destructive/20 text-destructive/70 hover:text-destructive transition-colors"
                        title="Clear all chats"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search chats..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                  />
                </div>

                {/* Chat Threads List */}
                <div className="space-y-1 max-h-[calc(100vh-28rem)] overflow-y-auto">
                  {(searchQuery ? searchThreads(searchQuery) : threads).map((thread) => (
                    <div
                      key={thread.id}
                      className={`group relative flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all cursor-pointer ${
                        thread.id === activeThreadId
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      <MessageSquare className={cn(
                        "h-3.5 w-3.5 flex-shrink-0",
                        thread.id === activeThreadId && isAssistantPage
                          ? "text-foreground"
                          : "text-muted-foreground"
                      )} />

                      {editingThreadId === thread.id ? (
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => {
                            renameThread(thread.id, editingTitle)
                            setEditingThreadId(null)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              renameThread(thread.id, editingTitle)
                              setEditingThreadId(null)
                            } else if (e.key === 'Escape') {
                              setEditingThreadId(null)
                            }
                          }}
                          className="flex-1 bg-transparent border-b border-primary text-xs focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <div
                          onClick={() => {
                            switchThread(thread.id)
                            router.push('/assistant')
                          }}
                          className="flex-1 min-w-0"
                        >
                          <p className="text-xs truncate">{thread.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(thread.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      )}

                      {/* Thread Actions Menu */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpenThreadId(menuOpenThreadId === thread.id ? null : thread.id)
                          }}
                          className="p-1 rounded hover:bg-accent"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>

                        {menuOpenThreadId === thread.id && (
                          <div className="absolute right-0 top-8 bg-popover border border-border rounded-md shadow-lg z-50">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingThreadId(thread.id)
                                setEditingTitle(thread.title)
                                setMenuOpenThreadId(null)
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent w-full text-left"
                            >
                              <Pencil className="h-3 w-3" />
                              Rename
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteThread(thread.id)
                                setMenuOpenThreadId(null)
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent w-full text-left text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {threads.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No chats yet. Start a new conversation!
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Bottom Section - Always visible */}
        <div className="mt-auto border-t border-border bg-card">
            {/* Settings */}
            <Link
              href="/dashboard/settings"
              className={`flex items-center gap-3 px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors group relative block ${
                collapsed ? 'justify-center' : ''
              }`}
              title={collapsed ? 'Settings' : undefined}
            >
              <Settings className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium">Settings</span>}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg">
                  Settings
                </div>
              )}
            </Link>

            {/* Sign Out Button */}
            <button
              onClick={logout}
              className={`flex items-center gap-3 px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors group relative w-full ${
                collapsed ? 'justify-center' : ''
              }`}
              title={collapsed ? 'Sign out' : undefined}
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium">Sign out</span>}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg">
                  Sign out
                </div>
              )}
            </button>
        </div>
      </aside>
    </>
  )
}