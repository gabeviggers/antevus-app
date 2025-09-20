'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { Search, ArrowLeft, Loader2, AlertCircle, CheckCircle, Wifi, WifiOff, Activity, CheckSquare, Square } from 'lucide-react'
import { logger } from '@/lib/logger'

interface Instrument {
  id: string
  name: string
  model: string
  serial: string
  status: 'online' | 'offline' | 'idle' | 'running' | 'error' | 'maintenance'
  location?: string
  selected: boolean
}

// Generate realistic mock instruments for demo
const generateMockInstruments = (): Omit<Instrument, 'selected'>[] => {
  const types = ['HPLC', 'qPCR', 'PlateReader', 'Centrifuge', 'Incubator', 'Freezer', 'Spectrophotometer', 'Microscope', 'MassSpec', 'FlowCytometer']
  const brands = ['Agilent', 'BioRad', 'Tecan', 'Thermo', 'Eppendorf', 'Zeiss', 'Waters', 'PerkinElmer', 'Beckman', 'Illumina']
  const statuses: Instrument['status'][] = ['online', 'idle', 'offline', 'running']
  const locations = ['Lab A - Bench 1', 'Lab B - Room 201', 'Core Facility', 'Cold Room', 'Instrument Room']

  return Array.from({ length: 20 }, (_, i) => {
    const type = types[i % types.length]
    const brand = brands[i % brands.length]
    return {
      id: `inst-${i + 1}`,
      name: `${brand} ${type}-${1000 + i}`,
      model: `${brand} Model ${2020 + (i % 5)}`,
      serial: `${brand.substring(0, 2).toUpperCase()}${10000000 + i}`,
      status: statuses[i % statuses.length],
      location: locations[i % locations.length]
    }
  })
}

export default function InstrumentsDiscoveryPage() {
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [scanning, setScanning] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | Instrument['status']>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()

  // Load existing instrument selections from API
  useEffect(() => {
    const loadInstrumentsData = async () => {
      setIsLoadingData(true)
      try {
        const response = await fetch('/api/onboarding/instruments', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const data = await response.json()

          // If user has already selected instruments, pre-populate
          if (data.instrumentsData?.selectedInstruments) {
            const savedInstruments = data.instrumentsData.selectedInstruments
            const mockInsts = generateMockInstruments()

            // Merge saved selections with mock data
            const mergedInstruments = mockInsts.map(inst => ({
              ...inst,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              selected: savedInstruments.some((saved: any) => saved.serial === inst.serial)
            }))

            setInstruments(mergedInstruments)
            setScanning(false)
          } else {
            // First time - simulate scanning
            simulateNetworkScan()
          }
        } else {
          // No existing data - simulate scanning
          simulateNetworkScan()
        }
      } catch (err) {
        logger.error('Failed to load instruments data', err)
        simulateNetworkScan()
      } finally {
        setIsLoadingData(false)
      }
    }

    loadInstrumentsData()
  }, [])

  const simulateNetworkScan = () => {
    setScanning(true)
    // Simulate network scanning animation
    setTimeout(() => {
      const mockInsts = generateMockInstruments()
      setInstruments(mockInsts.map(inst => ({ ...inst, selected: false })))
      setScanning(false)
    }, 2000)
  }

  const handleToggleInstrument = (id: string) => {
    setInstruments(prev =>
      prev.map(inst =>
        inst.id === id ? { ...inst, selected: !inst.selected } : inst
      )
    )
    // Clear any previous errors when user makes changes
    if (error) setError('')
  }

  const handleSelectAll = () => {
    const filtered = getFilteredInstruments()
    const allSelected = filtered.every(inst => inst.selected)

    setInstruments(prev =>
      prev.map(inst => {
        const isInFiltered = filtered.some(f => f.id === inst.id)
        return isInFiltered ? { ...inst, selected: !allSelected } : inst
      })
    )
  }

  const getFilteredInstruments = () => {
    return instruments.filter(inst => {
      const matchesStatus = filterStatus === 'all' || inst.status === filterStatus
      const matchesSearch = searchQuery === '' ||
        inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.serial.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesStatus && matchesSearch
    })
  }

  const getSelectedCount = () => instruments.filter(i => i.selected).length

  const handleContinue = async () => {
    const selectedInstruments = instruments.filter(i => i.selected)

    if (selectedInstruments.length === 0) {
      setError('Please select at least one instrument to continue')
      return
    }

    if (selectedInstruments.length > 50) {
      setError('Maximum 50 instruments can be selected at once')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // ✅ SECURE: Save to server API, not localStorage
      const response = await fetch('/api/onboarding/instruments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          selectedInstruments: selectedInstruments.map(inst => ({
            id: inst.id,
            name: inst.name,
            model: inst.model,
            serial: inst.serial,
            status: inst.status,
            location: inst.location
          }))
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save instruments')
      }

      setSuccess(true)

      logger.info('Instruments saved successfully', {
        count: selectedInstruments.length,
        nextStep: data.nextStep
      })

      // Navigate to next step
      setTimeout(() => {
        router.push(`/onboarding/${data.nextStep || 'agent'}`)
      }, 500)

    } catch (err) {
      logger.error('Instruments save error', err)
      setError(err instanceof Error ? err.message : 'Failed to save instruments. Please try again.')
      setSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    router.push('/onboarding/profile')
  }

  const filteredInstruments = getFilteredInstruments()
  const selectedCount = getSelectedCount()

  if (isLoadingData || scanning) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {scanning ? 'Scanning Network for Instruments...' : 'Loading...'}
        </h2>
        {scanning && (
          <p className="text-muted-foreground text-sm">
            Discovering laboratory instruments on your network
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Progress bar */}
      <div className="w-full bg-muted">
        <div className="h-1.5 bg-primary transition-all duration-500" style={{ width: '40%' }} />
      </div>

      {/* Header */}
      <div className="border-b bg-card">
        <div className="container max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              disabled={isLoading}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div className="text-sm text-muted-foreground">
              Step 2 of 5
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Main content - scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="container max-w-6xl mx-auto px-4 py-4 h-full flex flex-col">
          {/* Title - compact */}
          <div className="text-center mb-2">
            <h1 className="text-2xl font-bold">Select Your Instruments</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Found {instruments.length} instruments • Select the ones to connect
            </p>
          </div>

          {/* Error/Success Messages - more compact */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-2.5 flex items-start gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <p className="text-xs font-medium text-destructive flex-1">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2.5 flex items-start gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              <p className="text-xs font-medium text-green-600 flex-1">
                {selectedCount} instruments saved successfully!
              </p>
            </div>
          )}

          {/* Search Bar - elegant and prominent */}
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, model, or serial number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <span className="text-sm">×</span>
                </button>
              )}
            </div>
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  filterStatus === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                All ({instruments.length})
              </button>
              <button
                onClick={() => setFilterStatus('online')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1 ${
                  filterStatus === 'online'
                    ? 'bg-green-500 text-white'
                    : 'bg-green-500/10 text-green-600 hover:bg-green-500/20'
                }`}
              >
                <Wifi className="h-3 w-3" />
                Online ({instruments.filter(i => i.status === 'online').length})
              </button>
              <button
                onClick={() => setFilterStatus('idle')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1 ${
                  filterStatus === 'idle'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20'
                }`}
              >
                <Activity className="h-3 w-3" />
                Idle ({instruments.filter(i => i.status === 'idle').length})
              </button>
              <button
                onClick={() => setFilterStatus('running')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1 ${
                  filterStatus === 'running'
                    ? 'bg-blue-500 text-white'
                    : 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20'
                }`}
              >
                <Activity className="h-3 w-3 animate-pulse" />
                Running ({instruments.filter(i => i.status === 'running').length})
              </button>
              <button
                onClick={() => setFilterStatus('offline')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1 ${
                  filterStatus === 'offline'
                    ? 'bg-gray-500 text-white'
                    : 'bg-gray-500/10 text-gray-600 hover:bg-gray-500/20'
                }`}
              >
                <WifiOff className="h-3 w-3" />
                Offline ({instruments.filter(i => i.status === 'offline').length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {selectedCount} of {filteredInstruments.length} selected
              </span>
            </div>
          </div>

          {/* Batch Selection Actions */}
          {filteredInstruments.length > 0 && (
            <div className="flex gap-2 mb-3 border-t pt-3">
              <button
                onClick={handleSelectAll}
                className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                {filteredInstruments.every(i => i.selected) ? 'Deselect All' : 'Select All'}
              </button>
              {selectedCount > 0 && (
                <button
                  onClick={() => setInstruments(prev => prev.map(inst => ({ ...inst, selected: false })))}
                  className="px-3 py-1.5 text-xs bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors"
                >
                  Clear Selection
                </button>
              )}
              <button
                onClick={() => {
                  // Toggle selection
                  setInstruments(prev => prev.map(inst => {
                    const isInFiltered = filteredInstruments.some(f => f.id === inst.id)
                    return isInFiltered ? { ...inst, selected: !inst.selected } : inst
                  }))
                }}
                className="px-3 py-1.5 text-xs bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors"
              >
                Invert Selection
              </button>
            </div>
          )}

          {/* Instruments grid - scrollable area */}
          <div className="flex-1 overflow-y-auto mb-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredInstruments.map((instrument) => (
              <div
                key={instrument.id}
                onClick={() => handleToggleInstrument(instrument.id)}
                className={`relative border rounded-lg p-2.5 cursor-pointer transition-all ${
                  instrument.selected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary ring-opacity-20'
                    : 'border-border hover:border-primary/50 hover:bg-accent/5'
                }`}
              >
                {/* Selection indicator */}
                <div className="absolute top-2 right-2">
                  {instrument.selected ? (
                    <CheckSquare className="h-4 w-4 text-primary" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                <div className="flex items-start justify-between pr-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      {instrument.status === 'online' && (
                        <Wifi className="h-3 w-3 text-green-500" />
                      )}
                      {instrument.status === 'offline' && (
                        <WifiOff className="h-3 w-3 text-gray-400" />
                      )}
                      {instrument.status === 'idle' && (
                        <Activity className="h-3 w-3 text-yellow-500" />
                      )}
                      {instrument.status === 'running' && (
                        <Activity className="h-3 w-3 text-blue-500 animate-pulse" />
                      )}
                      <h3 className="font-medium text-xs">{instrument.name}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {instrument.model}
                    </p>
                    {instrument.location && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        📍 {instrument.location}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className={`inline-block px-1.5 py-0.5 text-xs rounded-full ${
                    instrument.status === 'online' ? 'bg-green-100 text-green-700' :
                    instrument.status === 'idle' ? 'bg-yellow-100 text-yellow-700' :
                    instrument.status === 'running' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {instrument.status}
                  </span>
                  {instrument.selected && (
                    <span className="text-xs text-primary font-medium">Selected</span>
                  )}
                </div>
              </div>
            ))}
            </div>
          </div>

          {filteredInstruments.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                No instruments found matching your filters
              </p>
            </div>
          )}

          {/* Continue button - always visible at bottom */}
          <div className="flex justify-between items-center pt-2 mt-auto border-t">
            <div className="flex items-center gap-2">
              {selectedCount > 0 && (
                <button
                  onClick={() => {
                    // Quick connect selected instruments
                    const onlineInstruments = instruments.filter(i => i.selected && i.status === 'online')
                    if (onlineInstruments.length > 0) {
                      setSuccess(true)
                      setTimeout(() => setSuccess(false), 3000)
                    }
                  }}
                  className="px-3 py-1.5 text-xs bg-green-500/10 text-green-600 rounded-md hover:bg-green-500/20 transition-colors flex items-center gap-1"
                >
                  <Wifi className="h-3 w-3" />
                  Connect {selectedCount} Now
                </button>
              )}
              <p className="text-xs text-muted-foreground">
                {selectedCount > 0
                  ? `${selectedCount} instrument${selectedCount > 1 ? 's' : ''} ready`
                  : 'Select instruments to continue'
                }
              </p>
            </div>
            <button
              onClick={handleContinue}
              disabled={selectedCount === 0 || isLoading}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>Continue {selectedCount > 0 && `with ${selectedCount}`}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}