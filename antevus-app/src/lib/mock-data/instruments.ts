export type InstrumentStatus = 'running' | 'idle' | 'error' | 'maintenance'

export interface Instrument {
  id: string
  name: string
  model: string
  manufacturer: string
  type: string
  status: InstrumentStatus
  location: string
  lastRun: string
  nextMaintenance: string
  usage: number // percentage
  temperature?: number
  currentRun?: {
    id: string
    protocol: string
    progress: number
    timeRemaining: string
    startedAt: string
  }
  metrics: {
    totalRuns: number
    successRate: number
    avgRunTime: string
  }
}

export const mockInstruments: Instrument[] = [
  {
    id: 'INS-001',
    name: 'NovaSeq 6000',
    model: 'NovaSeq 6000 System',
    manufacturer: 'Illumina',
    type: 'DNA Sequencer',
    status: 'running',
    location: 'Lab A - Bay 3',
    lastRun: '2024-12-13T10:30:00Z',
    nextMaintenance: '2024-12-20',
    usage: 78,
    temperature: 19.5,
    currentRun: {
      id: 'RUN-2024-1213-001',
      protocol: 'Whole Genome Sequencing',
      progress: 67,
      timeRemaining: '2h 34m',
      startedAt: '2024-12-13T08:00:00Z'
    },
    metrics: {
      totalRuns: 342,
      successRate: 98.5,
      avgRunTime: '12h 15m'
    }
  },
  {
    id: 'INS-002',
    name: 'Freedom EVO 200',
    model: 'Freedom EVO 200',
    manufacturer: 'Tecan',
    type: 'Liquid Handler',
    status: 'idle',
    location: 'Lab B - Bench 1',
    lastRun: '2024-12-13T09:15:00Z',
    nextMaintenance: '2024-12-18',
    usage: 45,
    temperature: 21.0,
    metrics: {
      totalRuns: 1254,
      successRate: 99.2,
      avgRunTime: '45m'
    }
  },
  {
    id: 'INS-003',
    name: 'STAR Plus',
    model: 'Microlab STAR Plus',
    manufacturer: 'Hamilton',
    type: 'Liquid Handler',
    status: 'running',
    location: 'Lab A - Bay 1',
    lastRun: '2024-12-13T11:00:00Z',
    nextMaintenance: '2024-12-22',
    usage: 62,
    temperature: 20.5,
    currentRun: {
      id: 'RUN-2024-1213-002',
      protocol: 'Sample Preparation',
      progress: 35,
      timeRemaining: '1h 15m',
      startedAt: '2024-12-13T11:00:00Z'
    },
    metrics: {
      totalRuns: 891,
      successRate: 97.8,
      avgRunTime: '1h 30m'
    }
  },
  {
    id: 'INS-004',
    name: 'MiSeq FGx',
    model: 'MiSeq FGx System',
    manufacturer: 'Illumina',
    type: 'DNA Sequencer',
    status: 'error',
    location: 'Lab C - Bay 2',
    lastRun: '2024-12-13T07:00:00Z',
    nextMaintenance: '2024-12-15',
    usage: 0,
    temperature: 22.5,
    metrics: {
      totalRuns: 156,
      successRate: 96.2,
      avgRunTime: '8h 45m'
    }
  },
  {
    id: 'INS-005',
    name: 'Fluent 780',
    model: 'Fluent 780',
    manufacturer: 'Tecan',
    type: 'Liquid Handler',
    status: 'maintenance',
    location: 'Lab B - Bench 3',
    lastRun: '2024-12-12T16:30:00Z',
    nextMaintenance: '2024-12-13',
    usage: 0,
    temperature: 20.0,
    metrics: {
      totalRuns: 567,
      successRate: 98.9,
      avgRunTime: '2h 10m'
    }
  },
  {
    id: 'INS-006',
    name: 'NextSeq 2000',
    model: 'NextSeq 2000',
    manufacturer: 'Illumina',
    type: 'DNA Sequencer',
    status: 'idle',
    location: 'Lab A - Bay 2',
    lastRun: '2024-12-13T06:00:00Z',
    nextMaintenance: '2024-12-25',
    usage: 23,
    temperature: 19.8,
    metrics: {
      totalRuns: 423,
      successRate: 97.5,
      avgRunTime: '10h 30m'
    }
  },
  {
    id: 'INS-007',
    name: 'VANTAGE',
    model: 'Microlab VANTAGE',
    manufacturer: 'Hamilton',
    type: 'Liquid Handler',
    status: 'running',
    location: 'Lab C - Bench 2',
    lastRun: '2024-12-13T10:45:00Z',
    nextMaintenance: '2024-12-28',
    usage: 89,
    temperature: 21.2,
    currentRun: {
      id: 'RUN-2024-1213-003',
      protocol: 'High-Throughput Screening',
      progress: 92,
      timeRemaining: '15m',
      startedAt: '2024-12-13T10:45:00Z'
    },
    metrics: {
      totalRuns: 2341,
      successRate: 99.5,
      avgRunTime: '3h 20m'
    }
  },
  {
    id: 'INS-008',
    name: 'Freedom EVO 150',
    model: 'Freedom EVO 150',
    manufacturer: 'Tecan',
    type: 'Liquid Handler',
    status: 'idle',
    location: 'Lab D - Bench 1',
    lastRun: '2024-12-13T08:30:00Z',
    nextMaintenance: '2024-12-30',
    usage: 34,
    temperature: 20.8,
    metrics: {
      totalRuns: 789,
      successRate: 98.1,
      avgRunTime: '1h 45m'
    }
  }
]

// Function to get status color
export function getStatusColor(status: InstrumentStatus): string {
  switch (status) {
    case 'running':
      return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20'
    case 'idle':
      return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/20'
    case 'error':
      return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20'
    case 'maintenance':
      return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20'
    default:
      return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/20'
  }
}

// Function to get status icon
export function getStatusIcon(status: InstrumentStatus): string {
  switch (status) {
    case 'running':
      return '●' // Will animate with pulse
    case 'idle':
      return '○'
    case 'error':
      return '▲'
    case 'maintenance':
      return '⚙'
    default:
      return '○'
  }
}