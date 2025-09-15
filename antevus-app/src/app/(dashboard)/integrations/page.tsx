'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { auditLogger } from '@/lib/audit/logger'
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
  Filter,
  RefreshCw,
  Bell,
  Zap,
  CheckCircle,
  AlertCircle,
  PlusCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

export default function IntegrationsPage() {
  const { user } = useAuth()
  const [integrations, setIntegrations] = useState<Integration[]>(mockIntegrations)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<IntegrationCategory | 'all'>('all')
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

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

  // Group integrations by category for display
  const groupedIntegrations = useMemo(() => {
    const groups: Record<IntegrationCategory, Integration[]> = {
      eln_lims: [],
      communication: [],
      data_analysis: [],
      storage: [],
      automation: []
    }

    filteredIntegrations.forEach(integration => {
      groups[integration.category].push(integration)
    })

    return groups
  }, [filteredIntegrations])

  // Count connected integrations
  const connectedCount = integrations.filter(i => i.status === 'connected').length
  const errorCount = integrations.filter(i => i.status === 'error').length

  const handleConnect = (integration: Integration) => {
    setSelectedIntegration(integration)
    setIsConfigModalOpen(true)
  }

  const handleDisconnect = async (integration: Integration) => {
    // Log audit event
    auditLogger.logEvent(user, 'integration.disconnect', {
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

    // Log audit event
    auditLogger.logEvent(user, 'integration.configure', {
      resourceType: 'integration',
      resourceId: integration.id,
      success: true,
      metadata: {
        integrationName: integration.name,
        action: integration.status === 'connected' ? 'update' : 'connect'
      }
    })

    // Update integration with new config
    setTimeout(() => {
      const updated = updateIntegrationStatus(integration.id, 'connected', config)
      if (updated) {
        setIntegrations(prev => prev.map(i => i.id === integration.id ? updated : i))
      }
      setIsSyncing(false)
    }, 2000)
  }

  const handleSyncAll = async () => {
    setIsSyncing(true)

    // Update all connected integrations to syncing status
    setIntegrations(prev => prev.map(i =>
      i.status === 'connected' ? { ...i, status: 'syncing' as const } : i
    ))

    // Simulate sync process
    setTimeout(() => {
      setIntegrations(prev => prev.map(i =>
        i.status === 'syncing'
          ? { ...i, status: 'connected' as const, lastSync: new Date().toISOString() }
          : i
      ))
      setIsSyncing(false)
    }, 3000)
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
                {filteredIntegrations.map(integration => (
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