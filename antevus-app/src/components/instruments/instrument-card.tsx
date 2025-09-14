'use client'

import { MoreVertical, Activity, Clock, Thermometer, Wrench } from 'lucide-react'
import { Instrument, getStatusColor } from '@/lib/mock-data/instruments'

interface InstrumentCardProps {
  instrument: Instrument
  onClick?: () => void
}

export function InstrumentCard({ instrument, onClick }: InstrumentCardProps) {
  const statusColor = getStatusColor(instrument.status)

  // Format status text
  const statusText = instrument.status.charAt(0).toUpperCase() + instrument.status.slice(1)

  // Progress bar color based on status
  const progressBarColor = instrument.status === 'running'
    ? 'bg-green-500 dark:bg-green-400'
    : 'bg-gray-300 dark:bg-gray-600'

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault() // Prevent default space scrolling
      if (onClick) {
        onClick()
      }
    }
  }

  return (
    <div
      className="bg-card rounded-lg border border-border p-6 hover:shadow-lg transition-all duration-300 cursor-pointer relative overflow-hidden group focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${instrument.name} - Status: ${instrument.status}, Location: ${instrument.location}`}
    >
      {/* Status indicator ribbon */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${
        instrument.status === 'running' ? 'bg-green-500 animate-pulse' :
        instrument.status === 'error' ? 'bg-red-500' :
        instrument.status === 'maintenance' ? 'bg-yellow-500' :
        'bg-gray-300'
      }`} />

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {instrument.name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {instrument.manufacturer} • {instrument.model}
          </p>
        </div>
        <button className="p-1 rounded-md hover:bg-accent transition-colors">
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-2 mb-4">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColor}`}>
          {instrument.status === 'running' && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
            </span>
          )}
          {instrument.status === 'error' && (
            <span className="text-current">⚠</span>
          )}
          {instrument.status === 'maintenance' && (
            <Wrench className="h-3 w-3" />
          )}
          {statusText}
        </span>
        <span className="text-xs text-muted-foreground">
          {instrument.location}
        </span>
      </div>

      {/* Current Run Info (if running) */}
      {instrument.currentRun && (
        <div className="mb-4 p-3 bg-accent/50 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">{instrument.currentRun.protocol}</span>
            <span className="text-xs text-muted-foreground">
              {instrument.currentRun.timeRemaining} remaining
            </span>
          </div>
          <div className="w-full bg-background rounded-full h-2">
            <div
              className={`${progressBarColor} h-2 rounded-full transition-all duration-500`}
              style={{ width: `${instrument.currentRun.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Usage</p>
            <p className="text-sm font-medium">{instrument.usage}%</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Avg Run</p>
            <p className="text-sm font-medium">{instrument.metrics.avgRunTime}</p>
          </div>
        </div>
        {instrument.temperature != null && (
          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Temp</p>
              <p className="text-sm font-medium">{instrument.temperature}°C</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-green-500/20 flex items-center justify-center">
            <span className="text-xs">✓</span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Success</p>
            <p className="text-sm font-medium">{instrument.metrics.successRate}%</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div>
          <p className="text-xs text-muted-foreground">Total Runs</p>
          <p className="text-sm font-medium">{instrument.metrics.totalRuns.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Next Maintenance</p>
          <p className="text-sm font-medium">
            {(() => {
              // Parse YYYY-MM-DD as local date to avoid timezone issues
              const [year, month, day] = instrument.nextMaintenance.split('-').map(Number)
              const localDate = new Date(year, month - 1, day)
              return localDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })
            })()}
          </p>
        </div>
      </div>

      {/* Hover effect overlay */}
      <div className={`absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
    </div>
  )
}