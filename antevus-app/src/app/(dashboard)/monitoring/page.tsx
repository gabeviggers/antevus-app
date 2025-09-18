'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useSession } from '@/contexts/session-context'
import { auditLogger } from '@/lib/audit/logger'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import {
  generateInitialMonitoringData,
  generateNewDataPoint,
  checkQCStatus,
  METRIC_UNITS,
  METRIC_DISPLAY_NAMES,
  METRIC_COLORS,
  QC_THRESHOLDS,
  type MetricData
} from '@/lib/mock-data/monitoring'
import { mockInstruments } from '@/lib/mock-data/instruments'
import {
  Activity,
  Thermometer,
  Gauge,
  Waves,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Download,
  Maximize2,
  Settings,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { NotificationsDropdown } from '@/components/notifications/notifications-dropdown'
import { logger } from '@/lib/logger'
import { useNotifications } from '@/hooks/use-notifications'
import { useReportNotifications } from '@/hooks/use-report-notifications'

export default function MonitoringPage() {
  const { user } = useSession()
  const { notify } = useNotifications()
  const { notifyExportReady } = useReportNotifications()
  const [monitoringData, setMonitoringData] = useState<Map<string, MetricData>>(
    () => generateInitialMonitoringData()
  )
  const [selectedInstrument, setSelectedInstrument] = useState<string>('INS-001')
  const [selectedMetric, setSelectedMetric] = useState<keyof MetricData>('temperature')
  const [isConnected, setIsConnected] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [updateInterval, setUpdateInterval] = useState(2000) // 2 seconds
  const [showThresholds, setShowThresholds] = useState(true)
  const [instrumentSearch, setInstrumentSearch] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Helper to convert UserContext to User format for audit logging
  const getAuditUser = () => {
    return user ? {
      id: user.id,
      email: user.email,
      name: user.email, // Use email as name if not available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      role: user.roles[0] as any, // Use first role
      organization: 'Antevus Labs', // Default organization
      createdAt: new Date().toISOString()
    } : null
  }

  // Simulate WebSocket connection status changes
  useEffect(() => {
    const connectionInterval = setInterval(() => {
      // 95% of the time stay connected
      setIsConnected(Math.random() > 0.05)
    }, 30000) // Check every 30 seconds

    return () => clearInterval(connectionInterval)
  }, [])

  // Real-time data updates
  useEffect(() => {
    if (isPaused || !isConnected) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setMonitoringData(prevData => {
        const newData = new Map(prevData)

        // Performance optimization: Update only the selected instrument
        // Other instruments update at a slower rate (every 10 seconds)
        newData.forEach((metrics, instrumentId) => {
          // Skip update for non-selected instruments most of the time
          if (instrumentId !== selectedInstrument && Math.random() > 0.2) {
            return
          }

          const updatedMetrics = { ...metrics }

          // Update each metric
          Object.keys(updatedMetrics).forEach(metricKey => {
            const key = metricKey as keyof MetricData
            const metricData = updatedMetrics[key]
            const lastPoint = metricData[metricData.length - 1]

            const newPoint = generateNewDataPoint(
              key,
              lastPoint.value,
              instrumentId,
              lastPoint.instrumentName
            )

            // Keep only last 50 points for performance
            updatedMetrics[key] = [...metricData.slice(-49), newPoint]
          })

          newData.set(instrumentId, updatedMetrics)
        })

        return newData
      })
    }, updateInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [updateInterval, isPaused, isConnected, selectedInstrument])

  const currentInstrumentData = monitoringData.get(selectedInstrument)

  // Memoize currentMetricData to avoid dependency warning
  const currentMetricData = useMemo(() =>
    currentInstrumentData?.[selectedMetric] || [],
    [currentInstrumentData, selectedMetric]
  )

  const latestValue = currentMetricData[currentMetricData.length - 1]?.value || 0
  const qcStatus = checkQCStatus(latestValue, selectedMetric)
  const threshold = QC_THRESHOLDS.find(t => t.metric === selectedMetric)

  // Check if user has export permissions
  const canExport = true // For demo, all authenticated users can export

  // Format data for Recharts - memoized and optimized
  // Must be called before any conditional returns (React hooks rules)
  const chartData = useMemo(() => currentMetricData.map(point => ({
    time: new Date(point.timestamp).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }),
    value: point.value
  })), [currentMetricData])

  // Filter instruments based on search
  const filteredInstruments = useMemo(() => {
    const instrumentIds = Array.from(monitoringData.keys())
    if (!instrumentSearch) return instrumentIds

    return instrumentIds.filter(id => {
      const data = monitoringData.get(id)
      const name = data?.temperature[0]?.instrumentName || id
      const instrument = mockInstruments.find(inst => inst.id === id)

      const searchLower = instrumentSearch.toLowerCase()
      return (
        id.toLowerCase().includes(searchLower) ||
        name.toLowerCase().includes(searchLower) ||
        instrument?.model.toLowerCase().includes(searchLower) ||
        instrument?.manufacturer.toLowerCase().includes(searchLower)
      )
    })
  }, [monitoringData, instrumentSearch])

  // Scroll controls for instrument selector
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' })
    }
  }

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' })
    }
  }

  // Return early if threshold not found (defensive programming)
  if (!threshold) return null

  const getMetricIcon = (metric: keyof MetricData) => {
    switch (metric) {
      case 'temperature':
        return <Thermometer className="h-4 w-4" />
      case 'pressure':
        return <Gauge className="h-4 w-4" />
      case 'flowRate':
        return <Waves className="h-4 w-4" />
      case 'vibration':
        return <Activity className="h-4 w-4" />
    }
  }

  const getQCStatusIcon = (status: 'pass' | 'warning' | 'fail') => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-500" />
    }
  }

  const getQCStatusColor = (status: 'pass' | 'warning' | 'fail') => {
    switch (status) {
      case 'pass':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'fail':
        return 'text-red-600 bg-red-50 border-red-200'
    }
  }

  const handleExport = () => {
    if (!canExport) {
      notify({
        severity: 'error',
        title: 'Permission denied',
        description: 'You do not have permission to export data',
        source: 'monitoring'
      })
      return
    }
    try {
      notify({
        severity: 'info',
        title: 'Exporting data...',
        description: 'Preparing CSV export',
        source: 'monitoring'
      })

      // Simulate export delay
      setTimeout(() => {
        notifyExportReady('monitoring-data.csv', '2.4 MB')
      }, 2000)

      auditLogger.logEvent(getAuditUser(), 'data.export', {
        resourceType: 'monitoring',
        success: true,
        metadata: {
          instrument: selectedInstrument,
          metric: selectedMetric,
          recordCount: currentMetricData.length,
          format: 'CSV'
        }
      })
    } catch (e) {
      logger.warn('audit log failed', {
        error: e instanceof Error ? e.message : 'Unknown error'
      })
    }
    // Export current metric data as CSV
    const rows = [['Time', 'Value']]
    for (const point of currentMetricData) {
      rows.push([point.timestamp, String(point.value)])
    }
    const csv = rows.map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedInstrument}-${selectedMetric}-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold">Real-Time Monitoring</h1>
          <p className="text-muted-foreground mt-1">
            Live telemetry data from connected instruments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsDropdown />
          <ThemeToggle />
        </div>
      </div>

      {/* Status Bar with Controls */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Connection Status */}
          <div className="flex items-center gap-3">
            <div
              role="status"
              aria-atomic="true"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${
                isConnected
                  ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-300'
                  : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300'
              }`}
            >
              {isConnected ? (
                <>
                  <Wifi className="h-4 w-4" />
                  <span className="text-sm font-medium">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4" />
                  <span className="text-sm font-medium">Disconnected</span>
                </>
              )}
            </div>

            <div className="h-6 w-px bg-border" />

            {/* Playback Controls */}
            <Button
              variant={isPaused ? 'default' : 'outline'}
              size="sm"
              type="button"
              aria-pressed={!isPaused}
              onClick={() => setIsPaused(!isPaused)}
              className="gap-2"
            >
              {isPaused ? (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  Pause
                </>
              )}
            </Button>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-2">
            {/* Update Rate */}
            <div className="flex items-center gap-1 px-2 py-1 bg-muted/50 rounded-md">
              <span className="text-xs text-muted-foreground">Update:</span>
              <div className="flex gap-0.5">
                {[1, 2, 5, 10].map(seconds => (
                  <button
                    key={seconds}
                    onClick={() => setUpdateInterval(seconds * 1000)}
                    className={`px-2 py-0.5 text-xs rounded transition-colors ${
                      updateInterval === seconds * 1000
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
            </div>

            <div className="h-6 w-px bg-border" />

            {/* Export Button */}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={!canExport}
              onClick={handleExport}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Instrument Selector with Search */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search instruments by name, model, or manufacturer..."
              value={instrumentSearch}
              onChange={(e) => setInstrumentSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>

          {/* Scrollable Instrument List */}
          <div className="relative">
            {/* Scroll buttons */}
            <button
              onClick={scrollLeft}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 flex items-center justify-center bg-background border border-border rounded-full shadow-sm hover:bg-muted transition-colors"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={scrollRight}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 flex items-center justify-center bg-background border border-border rounded-full shadow-sm hover:bg-muted transition-colors"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Instrument buttons */}
            <div
              ref={scrollContainerRef}
              className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 px-10"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {filteredInstruments.length === 0 ? (
                <div className="text-sm text-muted-foreground py-2">No instruments found</div>
              ) : (
                filteredInstruments.map(instrumentId => {
                  const data = monitoringData.get(instrumentId)!
                  const name = data.temperature[0]?.instrumentName || instrumentId
                  const instrument = mockInstruments.find(inst => inst.id === instrumentId)

                  return (
                    <Button
                      key={instrumentId}
                      variant={selectedInstrument === instrumentId ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedInstrument(instrumentId)}
                      className="flex-shrink-0 gap-2"
                    >
                      <div className={`h-2 w-2 rounded-full ${
                        instrument?.status === 'running' ? 'bg-green-500' :
                        instrument?.status === 'error' ? 'bg-red-500' :
                        instrument?.status === 'maintenance' ? 'bg-yellow-500' :
                        'bg-gray-400'
                      }`} />
                      <span>{name}</span>
                      {instrument && (
                        <span className="text-xs text-muted-foreground">({instrument.model})</span>
                      )}
                    </Button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(METRIC_DISPLAY_NAMES) as Array<keyof MetricData>).map(metric => {
          const data = monitoringData.get(selectedInstrument)?.[metric] || []
          const latest = data[data.length - 1]?.value || 0
          const status = checkQCStatus(latest, metric)
          const isSelected = selectedMetric === metric

          return (
            <button
              key={metric}
              onClick={() => setSelectedMetric(metric)}
              className={`p-4 rounded-lg border transition-all ${
                isSelected
                  ? 'border-primary bg-accent shadow-sm'
                  : 'border-border hover:border-primary/50 hover:bg-accent/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getMetricIcon(metric)}
                  <span className="font-medium text-sm">
                    {METRIC_DISPLAY_NAMES[metric]}
                  </span>
                </div>
                {getQCStatusIcon(status)}
              </div>
              <div className="text-2xl font-bold">
                {latest.toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  {METRIC_UNITS[metric]}
                </span>
              </div>
              <div className={`text-xs mt-1 ${
                status === 'pass' ? 'text-green-600' :
                status === 'warning' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {status === 'pass' ? 'Within limits' :
                 status === 'warning' ? 'Near threshold' :
                 'Out of range'}
              </div>
            </button>
          )
        })}
      </div>

      {/* Main Chart */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">
              {METRIC_DISPLAY_NAMES[selectedMetric]} Trend
            </h2>
            <div className={`px-3 py-1 rounded-full border ${getQCStatusColor(qcStatus)}`}>
              <span className="text-sm font-medium">
                Current: {latestValue.toFixed(2)} {METRIC_UNITS[selectedMetric]}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowThresholds(!showThresholds)}
            >
              {showThresholds ? 'Hide' : 'Show'} Thresholds
            </Button>
            <Button variant="outline" size="sm">
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              domain={[
                threshold.warning.min - (threshold.warning.max - threshold.warning.min) * 0.1,
                threshold.warning.max + (threshold.warning.max - threshold.warning.min) * 0.1
              ]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
            />

            {/* Threshold lines */}
            {showThresholds && (
              <>
                <ReferenceLine
                  y={threshold.max}
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  label={{ value: "Max", position: "right" }}
                />
                <ReferenceLine
                  y={threshold.min}
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  label={{ value: "Min", position: "right" }}
                />
                <ReferenceLine
                  y={threshold.warning.max}
                  stroke="#f59e0b"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                />
                <ReferenceLine
                  y={threshold.warning.min}
                  stroke="#f59e0b"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                />
              </>
            )}

            <Line
              type="monotone"
              dataKey="value"
              stroke={METRIC_COLORS[selectedMetric]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              animationDuration={300}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* QC Thresholds Legend */}
        {showThresholds && (
          <div className="mt-4 flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-red-500"></div>
              <span className="text-muted-foreground">Critical Limits</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-yellow-500 opacity-50"></div>
              <span className="text-muted-foreground">Warning Thresholds</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-green-500"></div>
              <span className="text-muted-foreground">Optimal Range</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}