'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useNotifications } from '@/hooks/use-notifications'
import { useReportNotifications } from '@/hooks/use-report-notifications'

export function DemoNotifications() {
  const { notify } = useNotifications()
  const {
    notifyReportGenerating,
    notifyReportGenerated,
    notifyReportFailed,
    notifyExportReady
  } = useReportNotifications()

  const handleGenerateReport = () => {
    // Start generation
    notifyReportGenerating('Monthly Analysis Report')

    // Simulate generation process
    setTimeout(() => {
      // Randomly succeed or fail
      if (Math.random() > 0.3) {
        notifyReportGenerated('Monthly Analysis Report', 'RPT-2024-001')
      } else {
        notifyReportFailed('Monthly Analysis Report', 'Insufficient data for analysis')
      }
    }, 3000)
  }

  const handleExportData = () => {
    notify({
      severity: 'info',
      title: 'Preparing export...',
      description: 'Gathering instrument data',
      source: 'export'
    })

    setTimeout(() => {
      notifyExportReady('instrument-data-2024.csv', '12.4 MB')
    }, 2000)
  }

  const handleRunComplete = () => {
    notify({
      severity: 'success',
      title: 'Run #R-2024-0892 completed',
      description: 'Completed in 45 minutes',
      actions: [{
        label: 'View results',
        href: '/runs/R-2024-0892'
      }],
      source: 'runs',
      desktopEnabled: true
    })
  }

  const handleConnectionLost = () => {
    notify({
      severity: 'warning',
      title: 'Connection lost',
      description: 'Attempting to reconnect...',
      sticky: true,
      source: 'connection'
    })

    // Simulate reconnection
    setTimeout(() => {
      notify({
        severity: 'success',
        title: 'Connection restored',
        source: 'connection'
      })
    }, 5000)
  }

  const handleError = () => {
    notify({
      severity: 'error',
      title: 'Run failed',
      description: 'Insufficient sample volume detected',
      sticky: true,
      actions: [
        { label: 'View logs', href: '/runs/logs' },
        { label: 'Retry', onClick: () => console.log('Retrying...') }
      ],
      source: 'runs'
    })
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Notification Examples</h3>
      <div className="space-y-2">
        <Button onClick={handleGenerateReport} variant="outline" className="w-full justify-start">
          📊 Generate Report (with notifications)
        </Button>
        <Button onClick={handleExportData} variant="outline" className="w-full justify-start">
          💾 Export Data (with progress)
        </Button>
        <Button onClick={handleRunComplete} variant="outline" className="w-full justify-start">
          ✅ Simulate Run Complete
        </Button>
        <Button onClick={handleConnectionLost} variant="outline" className="w-full justify-start">
          🔌 Simulate Connection Loss
        </Button>
        <Button onClick={handleError} variant="outline" className="w-full justify-start">
          ❌ Simulate Error
        </Button>
      </div>
    </Card>
  )
}