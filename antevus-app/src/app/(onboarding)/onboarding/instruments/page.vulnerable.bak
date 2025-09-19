'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { Search, ArrowLeft } from 'lucide-react'

interface Instrument {
  id: string
  name: string
  model: string
  serial: string
  status: 'online' | 'idle' | 'offline'
  selected: boolean
}

// Generate more realistic mock data for testing
const generateMockInstruments = (): Instrument[] => {
  const types = ['HPLC', 'qPCR', 'PlateReader', 'Centrifuge', 'Incubator', 'Freezer', 'Spectrophotometer', 'Microscope']
  const brands = ['Agilent', 'BioRad', 'Tecan', 'Thermo', 'Eppendorf', 'Zeiss', 'Waters', 'PerkinElmer']
  const statuses: Array<'online' | 'idle' | 'offline'> = ['online', 'idle', 'offline']

  const instruments: Instrument[] = []

  // Generate 15 instruments for demo (would be 30-100 in real lab)
  for (let i = 1; i <= 15; i++) {
    const type = types[Math.floor(Math.random() * types.length)]
    const brand = brands[Math.floor(Math.random() * brands.length)]
    instruments.push({
      id: i.toString(),
      name: `${type}-${brand}-${1000 + i}`,
      model: `Model ${2020 + (i % 5)}`,
      serial: `${brand.substring(0, 2).toUpperCase()}${10000000 + i}`,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      selected: false
    })
  }

  return instruments
}

const mockInstruments = generateMockInstruments()

export default function InstrumentsDiscoveryPage() {
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [scanning, setScanning] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'idle' | 'offline'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()

  // Simulate network scanning
  useEffect(() => {
    const scanTimer = setTimeout(() => {
      // In development, show mock instruments
      // In production, this would scan the real network
      if (process.env.NODE_ENV === 'development') {
        setInstruments(mockInstruments)
      } else {
        // Production: would call real API to scan network
        // For now, still show mock data
        setInstruments(mockInstruments)
      }
      setScanning(false)
    }, 2000)

    return () => clearTimeout(scanTimer)
  }, [])

  const toggleInstrument = (id: string) => {
    setInstruments(instruments.map(inst =>
      inst.id === id ? { ...inst, selected: !inst.selected } : inst
    ))
  }

  const selectAll = () => {
    setInstruments(instruments.map(inst => ({ ...inst, selected: true })))
  }

  const selectNone = () => {
    setInstruments(instruments.map(inst => ({ ...inst, selected: false })))
  }

  const selectOnline = () => {
    setInstruments(instruments.map(inst => ({
      ...inst,
      selected: inst.status === 'online'
    })))
  }

  // Filter instruments based on search and status
  const filteredInstruments = instruments.filter(inst => {
    const matchesSearch = inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         inst.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         inst.serial.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = filterStatus === 'all' || inst.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const selectedCount = instruments.filter(i => i.selected).length

  const handleContinue = () => {
    setIsLoading(true)
    // Save selected instruments (if any)
    if (typeof window !== 'undefined' && selectedCount > 0) {
      localStorage.setItem('onboarding_instruments', JSON.stringify(
        instruments.filter(i => i.selected)
      ))
    }
    router.push('/onboarding/endpoints')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-600'
      case 'idle':
        return 'text-yellow-600'
      case 'offline':
        return 'text-muted-foreground'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 flex justify-between items-center p-6">
        <button
          onClick={() => router.push('/onboarding/agent')}
          className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </button>
        <ThemeToggle />
      </header>

      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
        <div className="h-full w-3/5 bg-foreground transition-all duration-300" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Step Indicator */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Step 3 of 5
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Discover & Select Instruments
            </h2>
          </div>

          {/* Scanning Status */}
          {scanning ? (
            <div className="flex items-center justify-center py-8">
              <Search className="h-5 w-5 animate-pulse mr-2" />
              <span className="text-sm text-muted-foreground">
                Scanning network...
              </span>
            </div>
          ) : (
            <>
              {/* Search and Filters */}
              <div className="space-y-3">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search instruments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>

                {/* Quick Actions Bar */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      onClick={selectAll}
                      className="text-xs px-2 py-1 rounded border border-border hover:bg-accent transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      onClick={selectNone}
                      className="text-xs px-2 py-1 rounded border border-border hover:bg-accent transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      onClick={selectOnline}
                      className="text-xs px-2 py-1 rounded border border-border hover:bg-accent transition-colors"
                    >
                      Online Only
                    </button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedCount} of {instruments.length} selected
                  </div>
                </div>

                {/* Status Filter Tabs */}
                <div className="flex gap-1 p-1 bg-muted rounded-md">
                  {(['all', 'online', 'idle', 'offline'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`flex-1 text-xs py-1.5 px-2 rounded transition-colors ${
                        filterStatus === status
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                      {status !== 'all' && (
                        <span className="ml-1 opacity-60">
                          ({instruments.filter(i => i.status === status).length})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compact Table View */}
              <div className="border border-border rounded-md overflow-hidden">
                <div className="max-h-[320px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr className="text-xs">
                        <th className="text-left p-2 w-8">
                          <input
                            type="checkbox"
                            checked={filteredInstruments.length > 0 && filteredInstruments.every(i => i.selected)}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setInstruments(instruments.map(inst =>
                                filteredInstruments.find(f => f.id === inst.id)
                                  ? { ...inst, selected: checked }
                                  : inst
                              ))
                            }}
                            className="w-3 h-3"
                          />
                        </th>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2 hidden sm:table-cell">Model</th>
                        <th className="text-left p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredInstruments.length > 0 ? (
                        filteredInstruments.map((instrument) => (
                          <tr
                            key={instrument.id}
                            className="text-xs hover:bg-accent/50 cursor-pointer"
                            onClick={() => toggleInstrument(instrument.id)}
                          >
                            <td className="p-2" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={instrument.selected}
                                onChange={() => toggleInstrument(instrument.id)}
                                className="w-3 h-3"
                              />
                            </td>
                            <td className="p-2">
                              <div className="font-medium">{instrument.name}</div>
                              <div className="text-[10px] text-muted-foreground">{instrument.serial}</div>
                            </td>
                            <td className="p-2 hidden sm:table-cell text-muted-foreground">
                              {instrument.model}
                            </td>
                            <td className="p-2">
                              <span className={`inline-flex items-center gap-1 ${getStatusColor(instrument.status)}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                {instrument.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                            No instruments found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={handleContinue}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-md text-sm font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Loading...' :
                    selectedCount > 0 ? `Onboard ${selectedCount} Selected →` : 'Continue →'
                  }
                </button>
                {selectedCount === 0 && (
                  <p className="text-center text-xs text-muted-foreground">
                    No instruments selected - continue with demo data
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}