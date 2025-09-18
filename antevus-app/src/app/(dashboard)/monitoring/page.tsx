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
  RefreshCw,
  Download,
  Maximize2,
  Settings,
  Bell
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { logger } from '@/lib/logger'

export default function MonitoringPage() {
  const { user } = useSession()
  const [monitoringData, setMonitoringData] = useState<Map<string, MetricData>>(
    () => generateInitialMonitoringData()
  )
  const [selectedInstrument, setSelectedInstrument] = useState<string>('INS-001')
  const [selectedMetric, setSelectedMetric] = useState<keyof MetricData>('temperature')
  const [isConnected, setIsConnected] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [updateInterval, setUpdateInterval] = useState(2000) // 2 seconds
  const [showThresholds, setShowThresholds] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Notifications"
            title="Notifications"
            aria-haspopup="menu"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" aria-hidden="true" />
            <span className="sr-only">You have unread notifications</span>
          </Button>
          <ThemeToggle />
        </div>
      </div>

      {/* Connection Status and Controls */}
      <div className="flex items-center gap-2">
        {/* Connection Status */}
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

        {/* Controls */}
        <Button
          variant="outline"
          size="sm"
          type="button"
          aria-pressed={isPaused}
          onClick={() => setIsPaused(!isPaused)}
          className="gap-2"
        >
          {isPaused ? (
            <>
              <Activity className="h-4 w-4" />
              Resume
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Pause
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={!canExport}
          onClick={() => {
            if (!canExport) {
              alert('You do not have permission to export data')
              return
            }
            try {
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
          }}
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Instrument Selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from(monitoringData.keys()).map(instrumentId => {
          const data = monitoringData.get(instrumentId)!
          const name = data.temperature[0]?.instrumentName || instrumentId
          return (
            <Button
              key={instrumentId}
              variant={selectedInstrument === instrumentId ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedInstrument(instrumentId)}
            >
              {name}
            </Button>
          )
        })}
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

      {/* Update Rate Control */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Update Frequency</h3>
            <p className="text-sm text-muted-foreground">
              Data refresh rate: {updateInterval / 1000}s
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={updateInterval === 1000 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUpdateInterval(1000)}
            >
              1s
            </Button>
            <Button
              variant={updateInterval === 2000 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUpdateInterval(2000)}
            >
              2s
            </Button>
            <Button
              variant={updateInterval === 5000 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUpdateInterval(5000)}
            >
              5s
            </Button>
            <Button
              variant={updateInterval === 10000 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUpdateInterval(10000)}
            >
              10s
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}