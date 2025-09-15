'use client'

import { RunData } from '@/lib/mock-data/runs'
import { X, Download, CheckCircle, XCircle, AlertTriangle, FileText, Activity, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RunDetailModalProps {
  run: RunData | null
  onClose: () => void
}

export function RunDetailModal({ run, onClose }: RunDetailModalProps) {
  if (!run) return null

  const handleDownloadFile = (fileName: string) => {
    // Mock download - in real app would fetch from server
    alert(`Downloading ${fileName}...`)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20'
      case 'failed':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20'
      case 'aborted':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20'
      case 'in_progress':
        return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20'
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/20'
    }
  }

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent':
        return 'text-green-600 dark:text-green-400'
      case 'good':
        return 'text-blue-600 dark:text-blue-400'
      case 'fair':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'poor':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  // Mock chart data
  const generateMockChartData = () => {
    return Array.from({ length: 20 }, (_, i) => ({
      time: `${i * 5}m`,
      value: Math.random() * 100
    }))
  }

  const chartData = generateMockChartData()
  const maxValue = Math.max(...chartData.map(d => d.value))

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              Run Details: {run.id}
              <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(run.status)}`}>
                {run.status.replace('_', ' ')}
              </span>
            </h2>
            <p className="text-muted-foreground mt-1">
              {run.protocol} • {run.instrumentName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Run Information */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Run Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Started</p>
                    <p className="font-medium">
                      {new Date(run.startedAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="font-medium">{run.duration}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Operator</p>
                    <p className="font-medium">{run.operator}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Project</p>
                    <p className="font-medium">{run.project}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Samples</p>
                    <p className="font-medium">{run.samples}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data Size</p>
                    <p className="font-medium">{run.dataSize}</p>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Performance Metrics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(run.metrics).map(([key, value]) => (
                    <div key={key} className="text-center">
                      <p className="text-2xl font-bold">{value}{key === 'concentration' ? ' ng/µL' : key === 'coverage' ? 'x' : '%'}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Simple Chart Visualization */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Real-Time Data Preview</h3>
                <div className="h-48 relative">
                  {/* Simple bar chart */}
                  <div className="absolute inset-0 flex items-end justify-around px-2">
                    {chartData.map((point, i) => (
                      <div
                        key={i}
                        className="w-3 bg-primary hover:bg-primary/80 transition-all cursor-pointer group relative"
                        style={{ height: `${(point.value / maxValue) * 100}%` }}
                      >
                        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-popover text-popover-foreground px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {point.time}: {point.value.toFixed(1)}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Y-axis labels */}
                  <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-muted-foreground">
                    <span>{maxValue.toFixed(0)}</span>
                    <span>{(maxValue / 2).toFixed(0)}</span>
                    <span>0</span>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>0 min</span>
                  <span>50 min</span>
                  <span>100 min</span>
                </div>
              </div>

              {/* Notes */}
              {run.notes && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-sm">{run.notes}</p>
                </div>
              )}
            </div>

            {/* Right Column - QC & Files */}
            <div className="space-y-6">
              {/* QC Status */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  Quality Control
                  {run.qcStatus.passed ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </h3>
                <div className="space-y-2">
                  {run.qcStatus.checks.map((check, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-2">
                        {check.status === 'pass' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : check.status === 'warning' ? (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm">{check.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{check.value}</p>
                        <p className="text-xs text-muted-foreground">
                          Threshold: {check.threshold}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Quality */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Data Quality</h3>
                <div className="flex items-center justify-center py-4">
                  <div className="text-center">
                    <p className={`text-4xl font-bold ${getQualityColor(run.quality)}`}>
                      {run.quality.toUpperCase()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Overall Assessment</p>
                  </div>
                </div>
              </div>

              {/* Output Files */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Output Files
                </h3>
                <div className="space-y-2">
                  {run.outputFiles.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 px-3 bg-background rounded hover:bg-accent transition-colors cursor-pointer"
                      onClick={() => handleDownloadFile(file.name)}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium truncate max-w-[200px]">
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {file.type.toUpperCase()} • {file.size}
                          </p>
                        </div>
                      </div>
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {run.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border">
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Export Report
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download All Files
            </Button>
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}