'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/dashboard/sidebar'
import { ProtectedRoute } from '@/components/auth/protected-route'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex bg-background relative">
        {/* Sidebar */}
        <Sidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
        />

        {/* Main content - No header, just the page content */}
        <div className={`flex-1 min-w-0 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-52'}`}>
          <main className="h-full overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}