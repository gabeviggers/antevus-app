'use client'

import { useState, useEffect } from 'react'
import { InstrumentCard } from '@/components/instruments/instrument-card'
import { InstrumentDetailModal } from '@/components/instruments/instrument-detail-modal'
import { mockInstruments, type Instrument, type InstrumentStatus } from '@/lib/mock-data/instruments'
import { Search, Filter, RefreshCw, Plus, Grid3x3, List, Activity, Power, AlertTriangle, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { MetricCard } from '@/components/ui/metric-card'
import { NotificationsDropdown } from '@/components/notifications/notifications-dropdown'

export default function InstrumentsDashboard() {
  const [instruments, setInstruments] = useState<Instrument[]>(mockInstruments)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<InstrumentStatus | 'all'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setInstruments(prevInstruments => {
        return prevInstruments.map(instrument => {
          // Randomly update running instruments' progress
          if (instrument.status === 'running' && instrument.currentRun) {
            const newProgress = Math.min(instrument.currentRun.progress + Math.random() * 2, 100)
            if (newProgress >= 100) {
              // Complete the run
              return {
                ...instrument,
                status: 'idle' as InstrumentStatus,
                currentRun: undefined,
                lastRun: new Date().toISOString()
              }
            }
            return {
              ...instrument,
              currentRun: {
                ...instrument.currentRun,
                progress: Math.round(newProgress)
              }
            }
          }
          return instrument
        })
      })
    }, 3000) // Update every 3 seconds

    return () => clearInterval(interval)
  }, [])

  // Filter instruments based on search and status
  const filteredInstruments = instruments.filter(instrument => {
    const matchesSearch = instrument.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          instrument.manufacturer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          instrument.model.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || instrument.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Count instruments by status
  const statusCounts = {
    all: instruments.length,
    running: instruments.filter(i => i.status === 'running').length,
    idle: instruments.filter(i => i.status === 'idle').length,
    error: instruments.filter(i => i.status === 'error').length,
    maintenance: instruments.filter(i => i.status === 'maintenance').length
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setIsRefreshing(false)
    }, 1000)
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Instruments Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor and manage all laboratory instruments in real-time
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsDropdown />
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 mt-6">
        <MetricCard
          title="Total Instruments"
          value={statusCounts.all}
          icon={<Activity className="h-4 w-4" />}
          status="neutral"
          isSelected={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
        />
        <MetricCard
          title="Running"
          value={statusCounts.running}
          icon={<Activity className="h-4 w-4" />}
          status="pass"
          statusText={statusCounts.running > 0 ? 'Active' : 'None active'}
          isSelected={statusFilter === 'running'}
          onClick={() => setStatusFilter('running')}
        />
        <MetricCard
          title="Idle"
          value={statusCounts.idle}
          icon={<Power className="h-4 w-4" />}
          status="neutral"
          statusText="Available"
          isSelected={statusFilter === 'idle'}
          onClick={() => setStatusFilter('idle')}
        />
        <MetricCard
          title="Error"
          value={statusCounts.error}
          icon={<AlertTriangle className="h-4 w-4" />}
          status={statusCounts.error > 0 ? 'error' : 'pass'}
          statusText={statusCounts.error > 0 ? 'Attention required' : 'No errors'}
          isSelected={statusFilter === 'error'}
          onClick={() => setStatusFilter('error')}
        />
        <MetricCard
          title="Maintenance"
          value={statusCounts.maintenance}
          icon={<Wrench className="h-4 w-4" />}
          status={statusCounts.maintenance > 0 ? 'warning' : 'pass'}
          statusText={statusCounts.maintenance > 0 ? 'Service needed' : 'All operational'}
          isSelected={statusFilter === 'maintenance'}
          onClick={() => setStatusFilter('maintenance')}
        />
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search instruments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className={isRefreshing ? 'animate-spin' : ''}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <div className="flex rounded-md border border-input">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-accent' : ''}`}
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-accent' : ''}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Instrument
          </Button>
        </div>
      </div>

      {/* Instruments Grid */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredInstruments.map((instrument) => (
            <InstrumentCard
              key={instrument.id}
              instrument={instrument}
              onClick={() => setSelectedInstrument(instrument)}
            />
          ))}
        </div>
      ) : (
        // List view (simplified for now)
        <div className="space-y-2">
          {filteredInstruments.map((instrument) => (
            <div
              key={instrument.id}
              className="bg-card border border-border rounded-lg p-4 flex items-center justify-between hover:bg-accent cursor-pointer"
              onClick={() => setSelectedInstrument(instrument)}
            >
              <div className="flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${
                  instrument.status === 'running' ? 'bg-green-500 animate-pulse' :
                  instrument.status === 'error' ? 'bg-red-500' :
                  instrument.status === 'maintenance' ? 'bg-yellow-500' :
                  'bg-gray-300'
                }`} />
                <div>
                  <h3 className="font-medium">{instrument.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {instrument.manufacturer} • {instrument.location}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-sm font-medium">{instrument.status}</p>
                  <p className="text-xs text-muted-foreground">
                    {instrument.currentRun ? `${instrument.currentRun.progress}% complete` : 'Last run ' + new Date(instrument.lastRun).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {filteredInstruments.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No instruments found matching your criteria</p>
        </div>
      )}

      {/* Instrument Detail Modal */}
      <InstrumentDetailModal
        instrument={selectedInstrument}
        onClose={() => setSelectedInstrument(null)}
      />
    </div>
  )
}