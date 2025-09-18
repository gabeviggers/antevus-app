import { useCallback } from 'react'
import { useNotifications } from './use-notifications'

export function useReportNotifications() {
  const { notify } = useNotifications()

  const notifyReportGenerating = useCallback((reportName: string) => {
    return notify({
      severity: 'info',
      title: 'Generating report...',
      description: `Preparing "${reportName}"`,
      source: 'reports'
    })
  }, [notify])

  const notifyReportGenerated = useCallback((reportName: string, reportId: string) => {
    return notify({
      severity: 'success',
      title: 'Report generated',
      description: `Report "${reportName}" is ready for viewing`,
      actions: [{
        label: 'View report',
        href: `/reports/${reportId}`
      }],
      source: 'reports',
      correlationId: reportId,
      privacy: true, // May contain patient data
      desktopEnabled: true
    })
  }, [notify])

  const notifyReportFailed = useCallback((reportName: string, error?: string) => {
    return notify({
      severity: 'error',
      title: 'Report generation failed',
      description: error || `Failed to generate "${reportName}"`,
      sticky: true,
      actions: [{
        label: 'Retry',
        onClick: () => console.log('Retry report generation')
      }],
      source: 'reports'
    })
  }, [notify])

  const notifyExportReady = useCallback((fileName: string, size: string) => {
    return notify({
      severity: 'success',
      title: 'Export ready',
      description: `${fileName} (${size}) is ready for download`,
      actions: [{
        label: 'Download',
        onClick: () => console.log('Download file')
      }],
      source: 'exports',
      desktopEnabled: true
    })
  }, [notify])

  const notifyDataProcessing = useCallback(() => {
    return notify({
      severity: 'info',
      title: 'Processing data...',
      description: 'This may take a few moments',
      source: 'data',
      privacy: true
    })
  }, [notify])

  const notifyDataProcessingComplete = useCallback(() => {
    return notify({
      severity: 'success',
      title: 'Data processing complete',
      actions: [{
        label: 'View data',
        href: '/data'
      }],
      source: 'data',
      privacy: true
    })
  }, [notify])

  return {
    notifyReportGenerating,
    notifyReportGenerated,
    notifyReportFailed,
    notifyExportReady,
    notifyDataProcessing,
    notifyDataProcessingComplete
  }
}