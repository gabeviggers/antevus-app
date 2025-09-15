'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import {
  LayoutDashboard,
  Activity,
  History,
  Plug,
  Code2,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react'

const navigation = [
  { name: 'Instruments', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Monitoring', href: '/monitoring', icon: Activity },
  { name: 'Run History', href: '/runs', icon: History },
  { name: 'Integrations', href: '/integrations', icon: Plug },
  { name: 'API Playground', href: '/dashboard/api-playground', icon: Code2 },
]

interface SidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

export function Sidebar({ sidebarOpen, setSidebarOpen, collapsed, setCollapsed }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  // Get user initials for avatar
  const userInitials = user?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || 'U'

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
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-50 flex flex-col h-screen bg-card border-r border-border transition-all duration-300 lg:translate-x-0 ${
          collapsed ? 'w-16' : 'w-52'
        }`}
      >
        {/* Logo Section */}
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} h-16 px-4 border-b border-border`}>
          {!collapsed && (
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
          )}
          {collapsed && (
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
          )}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
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
          </div>
        </nav>

        {/* Bottom Section - Always visible */}
        <div className="mt-auto border-t border-border bg-card">
          {/* Settings */}
          <Link
            href="/dashboard/settings"
            className={`flex items-center gap-3 px-4 py-2.5 hover:bg-accent hover:text-accent-foreground transition-colors group relative ${
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

          {/* User Section */}
          <div className={`px-3 py-2.5 border-t border-border ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}>
            {!collapsed ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium">{userInitials}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email || 'email@example.com'}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user?.role?.replace('_', ' ') || 'role'}</p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <LogOut className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">Sign out</span>
                </button>
              </>
            ) : (
              <>
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-medium">{userInitials}</span>
                </div>
                <button
                  onClick={logout}
                  className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors group relative"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                  <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg">
                    Sign out
                  </div>
                </button>
              </>
            )}
          </div>

          {/* Collapse Toggle - Desktop only */}
          <div className="hidden lg:block border-t border-border">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-end'} px-3 py-2.5 hover:bg-accent transition-colors`}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}