'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { ArrowLeft, Play, Download, BarChart3, ChevronDown, ChevronUp } from 'lucide-react'

interface TimelineStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'complete'
  duration?: string
}

interface ResultRow {
  well: string
  od450: number
  status: 'positive' | 'negative' | 'control'
}

export default function HelloWorkflowPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [showOptionalSetup, setShowOptionalSetup] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Check if admin was redirected here
  useEffect(() => {
    const userRole = localStorage.getItem('onboarding_role')
    // Admins should have gone to team invite instead
    if (userRole === 'admin' || userRole === 'manager') {
      router.push('/onboarding/team')
    }
  }, [router])

  const [timeline, setTimeline] = useState<TimelineStep[]>([
    { id: '1', label: 'Initializing...', status: 'pending' },
    { id: '2', label: 'Loading plate...', status: 'pending' },
    { id: '3', label: 'Reading wells...', status: 'pending', duration: '45s' },
    { id: '4', label: 'Processing data...', status: 'pending' },
    { id: '5', label: 'Generating report...', status: 'pending' }
  ])

  const mockResults: ResultRow[] = [
    { well: 'A1', od450: 2.34, status: 'positive' },
    { well: 'A2', od450: 0.12, status: 'negative' },
    { well: 'A3', od450: 2.18, status: 'positive' },
    { well: 'A4', od450: 0.09, status: 'negative' },
    { well: 'B1', od450: 1.95, status: 'positive' },
    { well: 'B2', od450: 0.15, status: 'negative' },
    { well: 'CTRL+', od450: 2.50, status: 'control' },
    { well: 'CTRL-', od450: 0.05, status: 'control' }
  ]

  // Simulate workflow execution
  useEffect(() => {
    if (!isRunning || currentStep >= timeline.length) return

    const timer = setTimeout(() => {
      // Update timeline status
      setTimeline(prev => prev.map((step, idx) => {
        if (idx === currentStep) return { ...step, status: 'complete' }
        if (idx === currentStep + 1) return { ...step, status: 'running' }
        return step
      }))

      if (currentStep === timeline.length - 1) {
        setIsComplete(true)
        setIsRunning(false)
      } else {
        setCurrentStep(currentStep + 1)
      }
    }, currentStep === 2 ? 3000 : 1500) // Longer for "Reading wells" step

    return () => clearTimeout(timer)
  }, [isRunning, currentStep, timeline.length])

  const startWorkflow = () => {
    setIsRunning(true)
    setIsComplete(false)
    setCurrentStep(0)
    setTimeline(prev => prev.map((step, idx) => ({
      ...step,
      status: idx === 0 ? 'running' : 'pending'
    })))
  }

  const downloadCSV = () => {
    // In production, this would trigger actual CSV download
    const csvContent = 'Well,OD450,Status\n' +
      mockResults.map(r => `${r.well},${r.od450},${r.status}`).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'elisa-results.csv'
    a.click()
  }

  const finishSetup = () => {
    setIsLoading(true)

    // Mark onboarding as complete with timestamp
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboarding_complete', 'true')
      localStorage.setItem('onboarding_completed_at', new Date().toISOString())

      // Store the run results as well for dashboard
      localStorage.setItem('onboarding_first_run', JSON.stringify({
        runId: 'ELISA-001',
        instrument: 'PlateReader-03',
        completedAt: new Date().toISOString(),
        results: mockResults
      }))
    }

    // Navigate to dashboard
    router.push('/dashboard')
  }

  const getStatusEmoji = (status: 'positive' | 'negative' | 'control') => {
    switch (status) {
      case 'positive': return '✅'
      case 'negative': return '⭕'
      case 'control': return '🔬'
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 flex justify-between items-center p-6">
        <button
          onClick={() => router.push('/onboarding/endpoints')}
          className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </button>
        <ThemeToggle />
      </header>

      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
        <div className="h-full w-full bg-foreground transition-all duration-300" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Step Indicator */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Step 5 of 5
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Run Your First Workflow
            </h2>
          </div>

          {/* Online Instruments */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Online Instruments:</p>
            <div className="flex justify-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                HPLC-01
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                qPCR-02
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                PR-03
              </span>
            </div>
          </div>

          {/* Start Button */}
          {!isRunning && !isComplete && (
            <button
              onClick={startWorkflow}
              className="w-full py-3 px-4 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2"
            >
              <Play className="h-4 w-4" />
              <span className="font-medium">Start ELISA dry-run</span>
              <span className="text-sm opacity-80">on PlateReader-03</span>
            </button>
          )}

          {/* Status Timeline */}
          {(isRunning || isComplete) && (
            <div>
              <p className="text-sm font-medium mb-3">Status Timeline:</p>
              <div className="space-y-2">
                {timeline.map((step) => (
                  <div key={step.id} className="flex items-center gap-3 text-sm">
                    {step.status === 'complete' && (
                      <span className="text-green-600">✅</span>
                    )}
                    {step.status === 'running' && (
                      <div className="w-4 h-4 border-2 border-t-foreground border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
                    )}
                    {step.status === 'pending' && (
                      <span className="text-muted-foreground">⏳</span>
                    )}
                    <span className={step.status === 'pending' ? 'text-muted-foreground' : ''}>
                      {step.label}
                    </span>
                    {step.duration && step.status === 'running' && (
                      <span className="text-xs text-muted-foreground">({step.duration})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results Table */}
          {isComplete && (
            <div>
              <p className="text-sm font-medium mb-3">Results:</p>
              <div className="border border-border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2">Well</th>
                      <th className="text-left p-2">OD450</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {mockResults.slice(0, 4).map((result) => (
                      <tr key={result.well}>
                        <td className="p-2">{result.well}</td>
                        <td className="p-2">{result.od450.toFixed(2)}</td>
                        <td className="p-2">
                          <span className="flex items-center gap-1">
                            {getStatusEmoji(result.status)}
                            <span className="capitalize">{result.status}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={3} className="p-2 text-center text-xs text-muted-foreground">
                        ... {mockResults.length - 4} more rows
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={downloadCSV}
                  className="flex-1 py-2 px-3 rounded-md border border-border text-sm hover:bg-accent transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download CSV
                </button>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="flex-1 py-2 px-3 rounded-md border border-border text-sm hover:bg-accent transition-colors flex items-center justify-center gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  Open in Dashboard
                </button>
              </div>
            </div>
          )}

          {/* Optional Setup */}
          {isComplete && (
            <div>
              <button
                onClick={() => setShowOptionalSetup(!showOptionalSetup)}
                className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>Optional Setup</span>
                {showOptionalSetup ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showOptionalSetup && (
                <div className="mt-3 space-y-3 p-3 rounded-md border border-border bg-card">
                  <div className="text-sm space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-input" />
                      Configure Slack Integration
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-input" />
                      Set Usage Alerts (80% / 95%)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-input" />
                      Enable Email Notifications
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Finish Button */}
          {isComplete && (
            <div className="flex justify-end">
              <button
                onClick={finishSetup}
                disabled={isLoading}
                className="px-6 py-2 rounded-md text-sm font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Setting up dashboard...' : 'Finish Setup →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}