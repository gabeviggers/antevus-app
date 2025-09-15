import { mockInstruments } from './instruments'

export type RunStatus = 'completed' | 'failed' | 'aborted' | 'in_progress'
export type DataQuality = 'excellent' | 'good' | 'fair' | 'poor'

export interface RunData {
  id: string
  instrumentId: string
  instrumentName: string
  protocol: string
  status: RunStatus
  quality: DataQuality
  startedAt: string
  completedAt: string | null
  duration: string
  durationMinutes?: number // Machine-readable duration for sorting/filtering
  operator: string
  project: string
  samples: number
  dataSize: string
  outputFiles: {
    name: string
    size: string
    type: string
  }[]
  metrics: {
    yield?: number
    purity?: number
    concentration?: number
    qScore?: number
    coverage?: number
    efficiency?: number
  }
  qcStatus: {
    passed: boolean
    checks: {
      name: string
      status: 'pass' | 'fail' | 'warning'
      value: number
      threshold: number
    }[]
  }
  notes?: string
  tags: string[]
}

// Protocol names for different instrument types
const protocols = {
  'DNA Sequencer': [
    'Whole Genome Sequencing',
    'Targeted Sequencing',
    'RNA-Seq Analysis',
    'ChIP-Seq Protocol',
    'Amplicon Sequencing',
    'Metagenomics Analysis',
    'Single Cell Sequencing',
    'Exome Sequencing'
  ],
  'Liquid Handler': [
    'Sample Preparation',
    'High-Throughput Screening',
    'PCR Setup',
    'ELISA Protocol',
    'Cell Culture Maintenance',
    'Compound Dilution',
    'DNA Extraction',
    'Protein Purification'
  ]
}

const operators = [
  'Dr. Sarah Chen',
  'Mike Johnson',
  'Dr. Emily Rodriguez',
  'James Wilson',
  'Dr. Alex Kumar',
  'Lisa Thompson',
  'Dr. Robert Lee',
  'Maria Garcia'
]

const projects = [
  'COVID-19 Variant Study',
  'Cancer Genomics Initiative',
  'Drug Discovery Pipeline',
  'Microbiome Analysis',
  'Protein Structure Study',
  'Gene Therapy Research',
  'Antibody Development',
  'Cell Line Validation',
  'Quality Control Batch',
  'Method Development'
]

const tags = [
  'urgent', 'validation', 'research', 'clinical', 'QC',
  'development', 'production', 'pilot', 'rerun', 'priority'
]

// Generate realistic run data
function generateRun(index: number): RunData {
  const instrument = mockInstruments[Math.floor(Math.random() * mockInstruments.length)]
  const instrumentType = instrument.type
  const protocolList = instrumentType === 'DNA Sequencer'
    ? protocols['DNA Sequencer']
    : protocols['Liquid Handler']

  const protocol = protocolList[Math.floor(Math.random() * protocolList.length)]
  const operator = operators[Math.floor(Math.random() * operators.length)]
  const project = projects[Math.floor(Math.random() * projects.length)]

  // Generate dates (runs from last 30 days)
  const daysAgo = Math.floor(Math.random() * 30)
  const hoursAgo = Math.floor(Math.random() * 24)
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysAgo)
  startDate.setHours(startDate.getHours() - hoursAgo)

  // Duration between 30 minutes and 24 hours
  const durationMinutes = Math.floor(Math.random() * 1410) + 30
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000)

  const hours = Math.floor(durationMinutes / 60)
  const minutes = durationMinutes % 60
  const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`

  // Status distribution: 80% completed, 10% failed, 5% aborted, 5% in_progress
  const statusRand = Math.random()
  const status: RunStatus = statusRand < 0.8 ? 'completed'
    : statusRand < 0.9 ? 'failed'
    : statusRand < 0.95 ? 'aborted'
    : 'in_progress'

  // Quality is determined once and used consistently everywhere
  const qualityRand = Math.random()
  const quality: DataQuality = qualityRand < 0.4 ? 'excellent'
    : qualityRand < 0.7 ? 'good'
    : qualityRand < 0.9 ? 'fair'
    : 'poor'

  // Generate metrics based on instrument type
  const metrics: RunData['metrics'] = instrumentType === 'DNA Sequencer' ? {
    yield: Math.floor(Math.random() * 100) + 200, // 200-300 Gb
    qScore: Math.floor(Math.random() * 10) + 30, // Q30-Q40
    coverage: Math.floor(Math.random() * 50) + 30, // 30x-80x
    purity: Math.floor(Math.random() * 20) + 80 // 80-100%
  } : {
    efficiency: Math.floor(Math.random() * 20) + 80, // 80-100%
    concentration: Math.floor(Math.random() * 500) + 100, // 100-600 ng/µL
    purity: Math.floor(Math.random() * 10) + 90 // 90-100%
  }

  // QC status type helper
  type QCStatus = 'pass' | 'fail' | 'warning'
  const QC = { pass: 'pass', fail: 'fail', warning: 'warning' } as const satisfies Record<QCStatus, QCStatus>

  // Generate QC checks
  const qcPassed = status === 'completed' && Math.random() > 0.1
  const qcChecks = instrumentType === 'DNA Sequencer' ? [
    { name: 'Cluster Density', status: qcPassed ? QC.pass : QC.fail, value: 1250, threshold: 1200 },
    { name: 'Q30 Score', status: qcPassed ? QC.pass : QC.warning, value: 91, threshold: 90 },
    { name: 'Error Rate', status: QC.pass, value: 0.8, threshold: 1.0 },
    { name: 'PhiX Alignment', status: QC.pass, value: 0.95, threshold: 0.90 }
  ] : [
    { name: 'Volume Accuracy', status: QC.pass, value: 98.5, threshold: 95 },
    { name: 'Cross-contamination', status: qcPassed ? QC.pass : QC.warning, value: 0.01, threshold: 0.05 },
    { name: 'Temperature Stability', status: QC.pass, value: 20.5, threshold: 21 },
    { name: 'Precision CV', status: QC.pass, value: 2.3, threshold: 5 }
  ]

  // Generate output files
  const outputFiles = instrumentType === 'DNA Sequencer' ? [
    { name: `RUN_${index}_R1.fastq.gz`, size: '12.4 GB', type: 'fastq' },
    { name: `RUN_${index}_R2.fastq.gz`, size: '12.4 GB', type: 'fastq' },
    { name: `RUN_${index}_summary.html`, size: '2.3 MB', type: 'html' },
    { name: `RUN_${index}_metrics.csv`, size: '45 KB', type: 'csv' }
  ] : [
    { name: `RUN_${index}_results.xlsx`, size: '1.2 MB', type: 'xlsx' },
    { name: `RUN_${index}_plate_layout.json`, size: '23 KB', type: 'json' },
    { name: `RUN_${index}_report.pdf`, size: '450 KB', type: 'pdf' }
  ]

  // Random tags (1-3 per run)
  const numTags = Math.floor(Math.random() * 3) + 1
  const runTags: string[] = []
  for (let i = 0; i < numTags; i++) {
    const tag = tags[Math.floor(Math.random() * tags.length)]
    if (!runTags.includes(tag)) {
      runTags.push(tag)
    }
  }

  // Use the year from the actual run date
  const runYear = startDate.getFullYear()
  const runId = `RUN-${runYear}-${String(index).padStart(4, '0')}`

  return {
    id: runId,
    instrumentId: instrument.id,
    instrumentName: instrument.name,
    protocol,
    status,
    quality, // Use the quality determined once above, consistently
    startedAt: startDate.toISOString(),
    completedAt: status !== 'in_progress' ? endDate.toISOString() : null,
    duration: status !== 'in_progress' ? duration : 'In Progress',
    durationMinutes: status !== 'in_progress' ? durationMinutes : undefined,
    operator,
    project,
    samples: Math.floor(Math.random() * 96) + 1,
    dataSize: instrumentType === 'DNA Sequencer'
      ? `${(Math.random() * 50 + 10).toFixed(1)} GB`
      : `${(Math.random() * 100 + 10).toFixed(1)} MB`,
    outputFiles,
    metrics,
    qcStatus: {
      passed: qcPassed,
      checks: qcChecks
    },
    notes: Math.random() > 0.7
      ? `${status === 'failed' ? 'Run failed due to instrument error. ' : ''}Sample quality was ${quality}. ${qcPassed ? 'All QC checks passed.' : 'Some QC checks require review.'}`
      : undefined,
    tags: runTags
  }
}

// Generate 150 mock runs - frozen to prevent accidental mutation
export const mockRuns: ReadonlyArray<Readonly<RunData>> = Object.freeze(
  Array.from({ length: 150 }, (_, i) => generateRun(i + 1))
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .map(r => Object.freeze(r))
)

// Helper functions for filtering and searching
export function searchRuns(runs: readonly RunData[], query: string): RunData[] {
  const lowerQuery = query.toLowerCase()
  return runs.filter(run =>
    run.id.toLowerCase().includes(lowerQuery) ||
    run.instrumentName.toLowerCase().includes(lowerQuery) ||
    run.protocol.toLowerCase().includes(lowerQuery) ||
    run.operator.toLowerCase().includes(lowerQuery) ||
    run.project.toLowerCase().includes(lowerQuery) ||
    run.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  )
}

export function filterRunsByStatus(runs: readonly RunData[], status: RunStatus | 'all'): RunData[] {
  if (status === 'all') return [...runs]
  return runs.filter(run => run.status === status)
}

export function filterRunsByDateRange(runs: readonly RunData[], startDate: Date, endDate: Date): RunData[] {
  let start = new Date(startDate)
  let end = new Date(endDate)

  // Handle inverted date ranges
  if (start > end) {
    [start, end] = [end, start] // swap
  }

  // If end has no time set (00:00:00), make it inclusive end-of-day
  if (end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0 && end.getMilliseconds() === 0) {
    end = new Date(end.getTime())
    end.setHours(23, 59, 59, 999)
  }

  return runs.filter(run => {
    const runDate = new Date(run.startedAt)
    return runDate >= start && runDate <= end
  })
}

export function filterRunsByInstrument(runs: readonly RunData[], instrumentId: string | 'all'): RunData[] {
  if (instrumentId === 'all') return [...runs]
  return runs.filter(run => run.instrumentId === instrumentId)
}

// Export functions
function escapeCSVCell(cell: unknown): string {
  const s = String(cell ?? '')
  const escaped = s.replace(/"/g, '""')
  // Prevent CSV injection by escaping leading special characters
  const needsExcelEscaping = /^[=\-+@]/.test(escaped)
  const safe = needsExcelEscaping ? `'${escaped}` : escaped
  return `"${safe}"`
}

export function exportToCSV(runs: readonly RunData[]): string {
  const headers = ['ID', 'Instrument', 'Protocol', 'Status', 'Quality', 'Started', 'Duration', 'Operator', 'Project', 'Samples', 'Data Size']
  const rows = runs.map(run => [
    run.id,
    run.instrumentName,
    run.protocol,
    run.status,
    run.quality,
    new Date(run.startedAt).toISOString(), // Use ISO format for consistency
    run.duration,
    run.operator,
    run.project,
    run.samples.toString(),
    run.dataSize
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCSVCell).join(','))
  ].join('\n')

  return csvContent
}

export function exportToJSON(runs: readonly RunData[]): string {
  return JSON.stringify(runs, null, 2)
}