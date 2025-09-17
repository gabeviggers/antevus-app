'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSession } from '@/contexts/session-context'
import { auditLogger } from '@/lib/audit/logger'
import { IntegrationErrorBoundary } from '@/components/error-boundary'
import {
  mockIntegrations,
  INTEGRATION_CATEGORIES,
  updateIntegrationStatus,
  type Integration,
  type IntegrationCategory,
  type IntegrationConfig
} from '@/lib/mock-data/integrations'
import { IntegrationCard } from '@/components/integrations/integration-card'
import { IntegrationConfigModal } from '@/components/integrations/integration-config-modal'
import {
  Search,
  RefreshCw,
  Bell,
  Zap,
  CheckCircle,
  AlertCircle,
  PlusCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

const ITEMS_PER_PAGE = 9 // 3x3 grid

export default function IntegrationsPage() {
  const { user } = useSession()
  const [integrations, setIntegrations] = useState<Integration[]>(mockIntegrations)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<IntegrationCategory | 'all'>('all')
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  // Helper to convert UserContext to User format for audit logging
  const getAuditUser = () => {
    return user ? {
      id: user.id,
      email: user.email,
      name: user.email, // Use email as name if not available
      role: user.roles[0] as any, // Use first role
      organization: 'Antevus Labs', // Default organization
      createdAt: new Date().toISOString()
    } : null
  }

  // Filter integrations based on search and category
  const filteredIntegrations = useMemo(() => {
    let filtered = [...integrations]

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        integration =>
          integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          integration.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          integration.features.some(f => f.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(integration => integration.category === selectedCategory)
    }

    return filtered
  }, [integrations, searchQuery, selectedCategory])

  // Pagination calculations
  const totalPages = Math.ceil(filteredIntegrations.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedIntegrations = filteredIntegrations.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedCategory])

  // Group integrations by category for display (when showing all categories)
  const groupedIntegrations = useMemo(() => {
    const groups: Record<IntegrationCategory, Integration[]> = {
      eln_lims: [],
      communication: [],
      data_analysis: [],
      storage: [],
      automation: []
    }

    paginatedIntegrations.forEach(integration => {
      groups[integration.category].push(integration)
    })

    return groups
  }, [paginatedIntegrations])

  // Count connected integrations
  const connectedCount = integrations.filter(i => i.status === 'connected').length
  const errorCount = integrations.filter(i => i.status === 'error').length

  const handleConnect = (integration: Integration) => {
    setSelectedIntegration(integration)
    setIsConfigModalOpen(true)
  }

  const handleDisconnect = async (integration: Integration) => {
    // Log audit event
    auditLogger.logEvent(getAuditUser(), 'integration.disconnect', {
      resourceType: 'integration',
      resourceId: integration.id,
      success: true,
      metadata: {
        integrationName: integration.name
      }
    })

    // Update integration status
    const updated = updateIntegrationStatus(integration.id, 'disconnected')
    if (updated) {
      setIntegrations(prev => prev.map(i => i.id === integration.id ? updated : i))
    }
  }

  const handleConfigure = (integration: Integration) => {
    setSelectedIntegration(integration)
    setIsConfigModalOpen(true)
  }

  const handleSaveConfig = async (integration: Integration, config: IntegrationConfig) => {
    // Simulate connecting
    setIsSyncing(true)

    try {
      // Log audit event
      auditLogger.logEvent(getAuditUser(), 'integration.configure', {
        resourceType: 'integration',
        resourceId: integration.id,
        success: true,
        metadata: {
          integrationName: integration.name,
          action: integration.status === 'connected' ? 'update' : 'connect'
        }
      })

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Update integration with new config
      const updated = updateIntegrationStatus(integration.id, 'connected', config)
      if (updated) {
        setIntegrations(prev => prev.map(i => i.id === integration.id ? updated : i))
      }
    } catch (error) {
      console.error('Error saving config:', error)
      // Log failure event
      auditLogger.logEvent(getAuditUser(), 'integration.error', {
        resourceType: 'integration',
        resourceId: integration.id,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Configuration failed',
        metadata: {
          integrationName: integration.name
        }
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSyncAll = async () => {
    setIsSyncing(true)

    const connectedIntegrations = integrations.filter(i => i.status === 'connected')

    // Set all connected integrations to syncing status
    setIntegrations(prev => prev.map(i =>
      i.status === 'connected' ? { ...i, status: 'syncing' as const } : i
    ))

    try {
      // Proper async handling with Promise.all to avoid race conditions
      const syncResults = await Promise.all(
        connectedIntegrations.map(async (integration) => {
          try {
            // Simulate individual sync with random delay
            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000))

            // Log successful sync
            auditLogger.logEvent(getAuditUser(), 'integration.sync', {
              resourceType: 'integration',
              resourceId: integration.id,
              success: true,
              metadata: {
                integrationName: integration.name,
                syncTime: new Date().toISOString()
              }
            })

            return {
              ...integration,
              status: 'connected' as const,
              lastSync: new Date().toISOString(),
              error: undefined
            }
          } catch (error) {
            // Handle individual sync errors
            auditLogger.logEvent(getAuditUser(), 'integration.error', {
              resourceType: 'integration',
              resourceId: integration.id,
              success: false,
              errorMessage: error instanceof Error ? error.message : 'Sync failed',
              metadata: {
                integrationName: integration.name
              }
            })

            return {
              ...integration,
              status: 'error' as const,
              error: 'Sync failed'
            }
          }
        })
      )

      // Update all integrations with sync results atomically
      setIntegrations(prev => prev.map(integration => {
        const syncResult = syncResults.find(r => r.id === integration.id)
        return syncResult || integration
      }))
    } catch (error) {
      console.error('Sync all failed:', error)

      // Revert all to connected status on catastrophic failure
      setIntegrations(prev => prev.map(i =>
        i.status === 'syncing' ? { ...i, status: 'connected' as const } : i
      ))
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Integrations</h1>
            <p className="text-muted-foreground">
              Connect your favorite tools and services to streamline your lab workflows
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{integrations.length}</div>
              <div className="text-sm text-muted-foreground">Available</div>
            </div>
          </div>
        </div>
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-950 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{connectedCount}</div>
              <div className="text-sm text-muted-foreground">Connected</div>
            </div>
          </div>
        </div>
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-950 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{errorCount}</div>
              <div className="text-sm text-muted-foreground">Errors</div>
            </div>
          </div>
        </div>
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-950 rounded-lg">
              <PlusCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {integrations.length - connectedCount}
              </div>
              <div className="text-sm text-muted-foreground">To Connect</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('all')}
          >
            All
          </Button>
          {Object.entries(INTEGRATION_CATEGORIES).map(([key, value]) => (
            <Button
              key={key}
              variant={selectedCategory === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(key as IntegrationCategory)}
              className="hidden md:inline-flex"
            >
              {value.label}
            </Button>
          ))}
        </div>

        {/* Sync Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncAll}
          disabled={isSyncing || connectedCount === 0}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          Sync All
        </Button>
      </div>

      {/* Mobile Category Selector */}
      <div className="md:hidden mb-6">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value as IntegrationCategory | 'all')}
          className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Categories</option>
          {Object.entries(INTEGRATION_CATEGORIES).map(([key, value]) => (
            <option key={key} value={key}>{value.label}</option>
          ))}
        </select>
      </div>

      {/* Integrations Grid by Category */}
      {selectedCategory === 'all' ? (
        <div className="space-y-8">
          {Object.entries(INTEGRATION_CATEGORIES).map(([categoryKey, categoryInfo]) => {
            const categoryIntegrations = groupedIntegrations[categoryKey as IntegrationCategory]
            if (categoryIntegrations.length === 0) return null

            return (
              <div key={categoryKey}>
                <div className="mb-4">
                  <h2 className="text-xl font-semibold mb-1">{categoryInfo.label}</h2>
                  <p className="text-sm text-muted-foreground">{categoryInfo.description}</p>
                </div>
                <IntegrationErrorBoundary>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryIntegrations.map(integration => (
                      <IntegrationCard
                        key={integration.id}
                        integration={integration}
                        onConnect={handleConnect}
                        onDisconnect={handleDisconnect}
                        onConfigure={handleConfigure}
                      />
                    ))}
                  </div>
                </IntegrationErrorBoundary>
              </div>
            )
          })}
        </div>
      ) : (
        <div>
          {filteredIntegrations.length > 0 ? (
            <>
              <div className="mb-4">
                <h2 className="text-xl font-semibold mb-1">
                  {INTEGRATION_CATEGORIES[selectedCategory].label}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {INTEGRATION_CATEGORIES[selectedCategory].description}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedIntegrations.map(integration => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    onConnect={handleConnect}
                    onDisconnect={handleDisconnect}
                    onConfigure={handleConfigure}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No integrations found matching your criteria</p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 7) {
                pageNum = i + 1
              } else if (currentPage <= 4) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 3) {
                pageNum = totalPages - 6 + i
              } else {
                if (i === 0) pageNum = 1
                else if (i === 6) pageNum = totalPages
                else if (i === 1 || i === 5) return <span key={i} className="px-2">...</span>
                else pageNum = currentPage - 3 + i
              }
              return (
                <Button
                  key={i}
                  variant={currentPage === pageNum ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className="w-10"
                >
                  {pageNum}
                </Button>
              )
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Configuration Modal */}
      <IntegrationConfigModal
        integration={selectedIntegration}
        isOpen={isConfigModalOpen}
        onClose={() => {
          setIsConfigModalOpen(false)
          setSelectedIntegration(null)
        }}
        onSave={handleSaveConfig}
      />
    </div>
  )
}