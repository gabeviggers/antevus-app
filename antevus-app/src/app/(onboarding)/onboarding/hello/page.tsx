'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { ArrowLeft, Play, Download, BarChart3, ChevronDown, ChevronUp } from 'lucide-react'
import { logger } from '@/lib/logger'

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
    // Check user role from secure API
    fetch('/api/onboarding/profile')
      .then(res => res.json())
      .then(data => {
        // Admins should have gone to team invite instead
        if (data.role === 'admin' || data.role === 'lab_manager') {
          router.push('/onboarding/team')
        }
      })
      .catch((error) => logger.error('Failed to fetch role data', error))
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

  const finishSetup = async () => {
    setIsLoading(true)

    try {
      // Mark onboarding as complete via secure API
      await fetch('/api/onboarding/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'hello',
          completed: true,
          onboardingComplete: true,
          firstRun: {
            runId: 'ELISA-001',
            instrument: 'PlateReader-03',
            completedAt: new Date().toISOString(),
            results: mockResults
          }
        })
      })

      // Navigate to dashboard
      router.push('/dashboard')
    } catch (error) {
      logger.error('Failed to complete onboarding', error)
      setIsLoading(false)
    }
  }

  const getStatusEmoji = (status: 'positive' | 'negative' | 'control') => {
    switch (status) {
      case 'positive': return '✅'
      case 'negative': return '⭕'
      case 'control': return '🔬'
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Progress bar */}
      <div className="w-full bg-muted">
        <div className="h-1.5 bg-primary transition-all duration-500" style={{ width: '100%' }} />
      </div>

      {/* Header */}
      <div className="border-b bg-card">
        <div className="container max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/onboarding/agent')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              disabled={isLoading}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div className="text-sm text-muted-foreground">
              Step 5 of 5
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Main content - scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="container max-w-2xl mx-auto px-4 py-3 h-full flex flex-col">
          {/* Title - compact */}
          <div className="text-center mb-2">
            <h1 className="text-2xl font-bold">Run Your First Workflow</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Let&apos;s test your setup with a sample ELISA run
            </p>
          </div>

          {/* Online Instruments - compact */}
          <div className="text-center mb-3">
            <p className="text-xs text-muted-foreground mb-1">Online Instruments:</p>
            <div className="flex justify-center gap-2 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                HPLC-01
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                qPCR-02
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                PR-03
              </span>
            </div>
          </div>

          {/* Start Button - compact */}
          {!isRunning && !isComplete && (
            <button
              onClick={startWorkflow}
              className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 mb-3"
            >
              <Play className="h-4 w-4" />
              <span className="font-medium text-sm">Start ELISA dry-run</span>
              <span className="text-xs opacity-80">on PlateReader-03</span>
            </button>
          )}

          {/* Status Timeline - compact */}
          {(isRunning || isComplete) && (
            <div className="mb-3">
              <p className="text-sm font-medium mb-2">Status Timeline:</p>
              <div className="space-y-1">
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

          {/* Results Table - compact and scrollable */}
          {isComplete && (
            <div className="flex-1 flex flex-col mb-3">
              <p className="text-sm font-medium mb-2">Results:</p>
              <div className="border border-border rounded-md overflow-hidden flex-1">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-1.5">Well</th>
                      <th className="text-left p-1.5">OD450</th>
                      <th className="text-left p-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {mockResults.slice(0, 4).map((result) => (
                      <tr key={result.well}>
                        <td className="p-1.5">{result.well}</td>
                        <td className="p-1.5">{result.od450.toFixed(2)}</td>
                        <td className="p-1.5">
                          <span className="flex items-center gap-0.5">
                            {getStatusEmoji(result.status)}
                            <span className="capitalize">{result.status}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={3} className="p-1.5 text-center text-xs text-muted-foreground">
                        ... {mockResults.length - 4} more rows
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Action Buttons - compact */}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={downloadCSV}
                  className="flex-1 py-1.5 px-2 rounded-md border border-border text-xs hover:bg-accent transition-colors flex items-center justify-center gap-1"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download CSV
                </button>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="flex-1 py-1.5 px-2 rounded-md border border-border text-xs hover:bg-accent transition-colors flex items-center justify-center gap-1"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  Open in Dashboard
                </button>
              </div>
            </div>
          )}

          {/* Optional Setup - compact */}
          {isComplete && (
            <div className="mb-3">
              <button
                onClick={() => setShowOptionalSetup(!showOptionalSetup)}
                className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <span>Optional Setup</span>
                {showOptionalSetup ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>

              {showOptionalSetup && (
                <div className="mt-2 space-y-2 p-2 rounded-md border border-border bg-card">
                  <div className="text-xs space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-input h-3 w-3" />
                      Configure Slack Integration
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-input h-3 w-3" />
                      Set Usage Alerts (80% / 95%)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-input h-3 w-3" />
                      Enable Email Notifications
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Finish Button - always at bottom */}
          {isComplete && (
            <div className="mt-auto pt-3 border-t flex justify-end">
              <button
                onClick={finishSetup}
                disabled={isLoading}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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