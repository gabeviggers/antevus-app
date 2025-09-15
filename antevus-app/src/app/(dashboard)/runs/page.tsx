'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { auditLogger } from '@/lib/audit/logger'
import {
  mockRuns,
  searchRuns,
  filterRunsByStatus,
  filterRunsByInstrument,
  exportToCSV,
  exportToJSON,
  type RunData,
  type RunStatus,
  type DataQuality
} from '@/lib/mock-data/runs'
import { mockInstruments } from '@/lib/mock-data/instruments'
import { RunDetailModal } from '@/components/runs/run-detail-modal'
import {
  Search,
  Filter,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Bell
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

export default function RunHistoryPage() {
  const { user, hasPermission } = useAuth()
  const [runs] = useState<RunData[]>([...mockRuns])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<RunStatus | 'all'>('all')
  const [instrumentFilter, setInstrumentFilter] = useState<string>('all')
  const [selectedRun, setSelectedRun] = useState<RunData | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  const itemsPerPage = 20

  // Apply filters and search
  const filteredRuns = useMemo(() => {
    let filtered = [...runs]

    // Search
    if (searchQuery) {
      filtered = searchRuns(filtered, searchQuery)
    }

    // Status filter
    filtered = filterRunsByStatus(filtered, statusFilter)

    // Instrument filter
    filtered = filterRunsByInstrument(filtered, instrumentFilter)

    // Date range filter
    if (dateRange.start && dateRange.end) {
      const startDate = new Date(dateRange.start)
      const endDate = new Date(dateRange.end)
      if (startDate <= endDate) {
        endDate.setHours(23, 59, 59, 999)
        filtered = filtered.filter(run => {
          const runDate = new Date(run.startedAt)
          return runDate >= startDate && runDate <= endDate
        })
      }
    }

    return filtered
  }, [runs, searchQuery, statusFilter, instrumentFilter, dateRange])

  // Pagination
  const totalPages = Math.ceil(filteredRuns.length / itemsPerPage)
  const paginatedRuns = filteredRuns.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Status counts
  const statusCounts = {
    all: runs.length,
    completed: runs.filter(r => r.status === 'completed').length,
    failed: runs.filter(r => r.status === 'failed').length,
    aborted: runs.filter(r => r.status === 'aborted').length,
    in_progress: runs.filter(r => r.status === 'in_progress').length
  }

  // Check if user has export permissions
  const canExport = hasPermission('export_data') || hasPermission('export_own_data')

  // Export handlers
  const handleExportCSV = () => {
    if (!canExport) {
      alert('You do not have permission to export data')
      return
    }

    // Log audit event
    auditLogger.logEvent(user, 'data.export', {
      resourceType: 'runs',
      success: true,
      metadata: {
        format: 'CSV',
        recordCount: filteredRuns.length,
        filters: { status: statusFilter, instrument: instrumentFilter, dateRange }
      }
    })

    const csv = exportToCSV(filteredRuns)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `run_history_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportJSON = () => {
    if (!canExport) {
      alert('You do not have permission to export data')
      return
    }

    // Log audit event
    auditLogger.logEvent(user, 'data.export', {
      resourceType: 'runs',
      success: true,
      metadata: {
        format: 'JSON',
        recordCount: filteredRuns.length,
        filters: { status: statusFilter, instrument: instrumentFilter, dateRange }
      }
    })

    const json = exportToJSON(filteredRuns)
    const blob = new Blob([json], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `run_history_${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportPDF = () => {
    if (!canExport) {
      alert('You do not have permission to export data')
      return
    }

    // Log audit event
    auditLogger.logEvent(user, 'data.export', {
      resourceType: 'runs',
      success: true,
      metadata: {
        format: 'PDF',
        recordCount: filteredRuns.length,
        filters: { status: statusFilter, instrument: instrumentFilter, dateRange }
      }
    })

    // For now, just alert - would integrate with a PDF library
    alert('PDF export would be implemented with a library like jsPDF')
  }

  const getStatusIcon = (status: RunStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'aborted':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />
    }
  }

  const getQualityBadge = (quality: DataQuality) => {
    const colors = {
      excellent: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 ring-1 ring-green-600/20 dark:ring-green-800/30',
      good: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 ring-1 ring-blue-600/20 dark:ring-blue-800/30',
      fair: 'bg-amber-50 text-amber-600 dark:bg-yellow-900/30 dark:text-yellow-400 ring-1 ring-amber-600/20 dark:ring-yellow-800/30',
      poor: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 ring-1 ring-red-600/20 dark:ring-red-800/30'
    }
    return colors[quality as keyof typeof colors] || colors.fair
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Run History</h1>
            <p className="text-muted-foreground">
              Browse and analyze all instrument runs, export data, and track performance metrics
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
              <span
                className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"
                aria-hidden="true"
              />
              <span className="sr-only">You have unread notifications</span>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <button
          onClick={() => { setStatusFilter('all'); setCurrentPage(1) }}
          className={`p-4 rounded-lg border transition-all ${
            statusFilter === 'all'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card border-border hover:bg-accent'
          }`}
        >
          <div className="text-2xl font-bold">{statusCounts.all}</div>
          <div className="text-sm">Total Runs</div>
        </button>
        <button
          onClick={() => { setStatusFilter('completed'); setCurrentPage(1) }}
          className={`p-4 rounded-lg border transition-all ${
            statusFilter === 'completed'
              ? 'bg-green-500 text-white border-green-500'
              : 'bg-card border-border hover:bg-accent'
          }`}
        >
          <div className="text-2xl font-bold">{statusCounts.completed}</div>
          <div className="text-sm">Completed</div>
        </button>
        <button
          onClick={() => { setStatusFilter('in_progress'); setCurrentPage(1) }}
          className={`p-4 rounded-lg border transition-all ${
            statusFilter === 'in_progress'
              ? 'bg-blue-500 text-white border-blue-500'
              : 'bg-card border-border hover:bg-accent'
          }`}
        >
          <div className="text-2xl font-bold">{statusCounts.in_progress}</div>
          <div className="text-sm">In Progress</div>
        </button>
        <button
          onClick={() => { setStatusFilter('failed'); setCurrentPage(1) }}
          className={`p-4 rounded-lg border transition-all ${
            statusFilter === 'failed'
              ? 'bg-red-500 text-white border-red-500'
              : 'bg-card border-border hover:bg-accent'
          }`}
        >
          <div className="text-2xl font-bold">{statusCounts.failed}</div>
          <div className="text-sm">Failed</div>
        </button>
        <button
          onClick={() => { setStatusFilter('aborted'); setCurrentPage(1) }}
          className={`p-4 rounded-lg border transition-all ${
            statusFilter === 'aborted'
              ? 'bg-yellow-500 text-white border-yellow-500'
              : 'bg-card border-border hover:bg-accent'
          }`}
        >
          <div className="text-2xl font-bold">{statusCounts.aborted}</div>
          <div className="text-sm">Aborted</div>
        </button>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by ID, instrument, protocol, operator, project..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1) // Reset to first page on search
            }}
            className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters {showFilters ? '▼' : '▶'}
          </Button>

          {/* Export Dropdown */}
          <div className="relative group">
            <Button variant="outline" size="sm" disabled={!canExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            {canExport && (
              <div className="absolute right-0 mt-1 w-48 bg-card border border-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={handleExportCSV}
                className="block w-full text-left px-4 py-2 hover:bg-accent transition-colors"
              >
                <FileText className="inline h-4 w-4 mr-2" />
                Export as CSV
              </button>
              <button
                onClick={handleExportJSON}
                className="block w-full text-left px-4 py-2 hover:bg-accent transition-colors"
              >
                <FileText className="inline h-4 w-4 mr-2" />
                Export as JSON
              </button>
              <button
                onClick={handleExportPDF}
                className="block w-full text-left px-4 py-2 hover:bg-accent transition-colors"
              >
                <FileText className="inline h-4 w-4 mr-2" />
                Export as PDF
              </button>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Instrument Filter */}
            <div>
              <label className="block text-sm font-medium mb-2">Instrument</label>
              <select
                value={instrumentFilter}
                onChange={(e) => {
                  setInstrumentFilter(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Instruments</option>
                {mockInstruments.map(instrument => (
                  <option key={instrument.id} value={instrument.id}>
                    {instrument.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium mb-2">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => {
                    setDateRange({ ...dateRange, start: e.target.value })
                    setCurrentPage(1)
                  }}
                  className="w-full pl-10 pr-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => {
                    setDateRange({ ...dateRange, end: e.target.value })
                    setCurrentPage(1)
                  }}
                  className="w-full pl-10 pr-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          {/* Clear Filters */}
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInstrumentFilter('all')
                setDateRange({ start: '', end: '' })
                setCurrentPage(1)
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      )}

      {/* Results Summary */}
      <div className="mb-4 text-sm text-muted-foreground">
        Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredRuns.length)} of {filteredRuns.length} runs
      </div>

      {/* Runs Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Run ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Instrument</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Protocol</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Quality</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Started</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Operator</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedRuns.map((run) => (
                <tr
                  key={run.id}
                  onClick={() => setSelectedRun(run)}
                  className="hover:bg-accent cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{run.id}</span>
                      {run.tags.includes('urgent') && (
                        <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">
                          Urgent
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{run.instrumentName}</td>
                  <td className="px-4 py-3 text-sm">{run.protocol}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(run.status)}
                      <span className="text-sm capitalize">{run.status.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getQualityBadge(run.quality)}`}>
                      {run.quality}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(run.startedAt).toLocaleDateString()}{' '}
                    <span className="text-muted-foreground">
                      {new Date(run.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{run.duration}</td>
                  <td className="px-4 py-3 text-sm">{run.operator}</td>
                  <td className="px-4 py-3 text-sm font-medium">{run.dataSize}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* No results */}
        {paginatedRuns.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No runs found matching your criteria</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Page numbers */}
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }

                return (
                  <Button
                    key={i}
                    variant={pageNum === currentPage ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="w-8"
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Run Detail Modal */}
      <RunDetailModal
        run={selectedRun}
        onClose={() => setSelectedRun(null)}
      />
    </div>
  )
}