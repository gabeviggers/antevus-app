'use client'

import { X, Activity, Clock, Thermometer, Wrench, Download, Share2, Calendar } from 'lucide-react'
import { Instrument, getStatusColor } from '@/lib/mock-data/instruments'
import { Button } from '@/components/ui/button'

interface InstrumentDetailModalProps {
  instrument: Instrument | null
  onClose: () => void
}

export function InstrumentDetailModal({ instrument, onClose }: InstrumentDetailModalProps) {
  if (!instrument) return null

  const statusColor = getStatusColor(instrument.status)
  const statusText = instrument.status.charAt(0).toUpperCase() + instrument.status.slice(1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="border-b border-border p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">{instrument.name}</h2>
              <p className="text-muted-foreground mt-1">
                {instrument.manufacturer} • {instrument.model}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                  {instrument.status === 'running' && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
                    </span>
                  )}
                  {statusText}
                </span>
                <span className="text-sm text-muted-foreground">
                  {instrument.location}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-accent transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Current Run Section (if running) */}
          {instrument.currentRun && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <h3 className="font-semibold mb-3 text-green-900 dark:text-green-100">Current Run</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Protocol</p>
                  <p className="font-medium">{instrument.currentRun.protocol}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Run ID</p>
                  <p className="font-medium font-mono text-sm">{instrument.currentRun.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Started At</p>
                  <p className="font-medium">
                    {new Date(instrument.currentRun.startedAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Time Remaining</p>
                  <p className="font-medium">{instrument.currentRun.timeRemaining}</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Progress</span>
                  <span>{instrument.currentRun.progress}%</span>
                </div>
                <div className="w-full bg-background rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${instrument.currentRun.progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-background p-4 rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Usage</span>
              </div>
              <p className="text-2xl font-bold">{instrument.usage}%</p>
            </div>
            <div className="bg-background p-4 rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Avg Run Time</span>
              </div>
              <p className="text-2xl font-bold">{instrument.metrics.avgRunTime}</p>
            </div>
            {instrument.temperature && (
              <div className="bg-background p-4 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Thermometer className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Temperature</span>
                </div>
                <p className="text-2xl font-bold">{instrument.temperature}°C</p>
              </div>
            )}
            <div className="bg-background p-4 rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-4 w-4 rounded-full bg-green-500/20 flex items-center justify-center">
                  <span className="text-xs">✓</span>
                </div>
                <span className="text-sm text-muted-foreground">Success Rate</span>
              </div>
              <p className="text-2xl font-bold">{instrument.metrics.successRate}%</p>
            </div>
          </div>

          {/* Details Section */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-semibold mb-3">Instrument Details</h3>
              <dl className="space-y-2">
                <div className="flex justify-between py-1">
                  <dt className="text-sm text-muted-foreground">ID</dt>
                  <dd className="text-sm font-medium font-mono">{instrument.id}</dd>
                </div>
                <div className="flex justify-between py-1">
                  <dt className="text-sm text-muted-foreground">Type</dt>
                  <dd className="text-sm font-medium">{instrument.type}</dd>
                </div>
                <div className="flex justify-between py-1">
                  <dt className="text-sm text-muted-foreground">Total Runs</dt>
                  <dd className="text-sm font-medium">{instrument.metrics.totalRuns.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between py-1">
                  <dt className="text-sm text-muted-foreground">Last Run</dt>
                  <dd className="text-sm font-medium">
                    {new Date(instrument.lastRun).toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>
            <div>
              <h3 className="font-semibold mb-3">Maintenance</h3>
              <dl className="space-y-2">
                <div className="flex justify-between py-1">
                  <dt className="text-sm text-muted-foreground">Next Scheduled</dt>
                  <dd className="text-sm font-medium">
                    {new Date(instrument.nextMaintenance).toLocaleDateString()}
                  </dd>
                </div>
                <div className="flex justify-between py-1">
                  <dt className="text-sm text-muted-foreground">Days Until</dt>
                  <dd className="text-sm font-medium">
                    {Math.ceil((new Date(instrument.nextMaintenance).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Recent Activity</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <div className="flex-1">
                  <p className="text-sm">Run completed successfully</p>
                  <p className="text-xs text-muted-foreground">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <div className="flex-1">
                  <p className="text-sm">Calibration performed</p>
                  <p className="text-xs text-muted-foreground">1 day ago</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
                <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                <div className="flex-1">
                  <p className="text-sm">Maintenance scheduled</p>
                  <p className="text-xs text-muted-foreground">3 days ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-6">
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
            <Button variant="outline" className="flex-1">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" className="flex-1">
              <Calendar className="h-4 w-4 mr-2" />
              Schedule
            </Button>
            <Button className="flex-1">
              View Full Details
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}