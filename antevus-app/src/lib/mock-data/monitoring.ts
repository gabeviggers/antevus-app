export interface MetricPoint {
  timestamp: string
  value: number
  instrumentId: string
  instrumentName: string
}

export interface MetricData {
  temperature: MetricPoint[]
  pressure: MetricPoint[]
  flowRate: MetricPoint[]
  vibration: MetricPoint[]
}

export interface QCThreshold {
  metric: keyof MetricData
  min: number
  max: number
  warning: {
    min: number
    max: number
  }
}

export const QC_THRESHOLDS: QCThreshold[] = [
  {
    metric: 'temperature',
    min: 20,
    max: 25,
    warning: {
      min: 18,
      max: 27
    }
  },
  {
    metric: 'pressure',
    min: 98,
    max: 102,
    warning: {
      min: 95,
      max: 105
    }
  },
  {
    metric: 'flowRate',
    min: 0.8,
    max: 1.2,
    warning: {
      min: 0.7,
      max: 1.3
    }
  },
  {
    metric: 'vibration',
    min: 0,
    max: 0.5,
    warning: {
      min: 0,
      max: 0.7
    }
  }
]

// Create indexed map for efficient threshold lookup
const THRESHOLDS_BY_METRIC: Record<keyof MetricData, QCThreshold> = {
  temperature: QC_THRESHOLDS[0],
  pressure: QC_THRESHOLDS[1],
  flowRate: QC_THRESHOLDS[2],
  vibration: QC_THRESHOLDS[3]
}

const INSTRUMENTS_FOR_MONITORING = [
  'Illumina NovaSeq X',
  'Tecan Freedom EVO',
  'Hamilton STAR',
  'Agilent HPLC 1290'
]

function generateHistoricalData(
  metric: keyof MetricData,
  instrumentId: string,
  instrumentName: string,
  points: number = 50
): MetricPoint[] {
  const data: MetricPoint[] = []
  const now = Date.now()
  const threshold = THRESHOLDS_BY_METRIC[metric]

  for (let i = points - 1; i >= 0; i--) {
    const timestamp = new Date(now - i * 5000).toISOString()
    let baseValue = (threshold.min + threshold.max) / 2

    // Add realistic variations based on metric type
    let variation = 0
    switch (metric) {
      case 'temperature':
        // Temperature changes slowly with small variations
        variation = (Math.sin(i / 10) * 0.5) + (Math.random() - 0.5) * 0.3
        baseValue += variation
        break
      case 'pressure':
        // Pressure has more sudden changes
        variation = (Math.sin(i / 5) * 1) + (Math.random() - 0.5) * 0.5
        baseValue += variation
        break
      case 'flowRate':
        // Flow rate can have periodic patterns
        variation = (Math.sin(i / 8) * 0.1) + (Math.random() - 0.5) * 0.05
        baseValue += variation
        break
      case 'vibration':
        // Vibration is usually low with occasional spikes
        variation = Math.random() < 0.1 ? Math.random() * 0.3 : Math.random() * 0.1
        baseValue = 0.2 + variation
        break
    }

    data.push({
      timestamp,
      value: parseFloat(baseValue.toFixed(2)),
      instrumentId,
      instrumentName
    })
  }

  return data
}

export function generateInitialMonitoringData(): Map<string, MetricData> {
  const dataMap = new Map<string, MetricData>()

  INSTRUMENTS_FOR_MONITORING.forEach((instrumentName, index) => {
    const instrumentId = `INS-${String(index + 1).padStart(3, '0')}`
    dataMap.set(instrumentId, {
      temperature: generateHistoricalData('temperature', instrumentId, instrumentName),
      pressure: generateHistoricalData('pressure', instrumentId, instrumentName),
      flowRate: generateHistoricalData('flowRate', instrumentId, instrumentName),
      vibration: generateHistoricalData('vibration', instrumentId, instrumentName)
    })
  })

  return dataMap
}

export function generateNewDataPoint(
  metric: keyof MetricData,
  lastValue: number,
  instrumentId: string,
  instrumentName: string
): MetricPoint {
  const threshold = THRESHOLDS_BY_METRIC[metric]
  let newValue = lastValue

  // Generate realistic changes based on metric type
  switch (metric) {
    case 'temperature':
      // Small gradual changes
      newValue += (Math.random() - 0.5) * 0.2
      break
    case 'pressure':
      // Slightly larger variations
      newValue += (Math.random() - 0.5) * 0.8
      break
    case 'flowRate':
      // Small variations around setpoint
      newValue += (Math.random() - 0.5) * 0.05
      break
    case 'vibration':
      // Usually stable with occasional changes
      newValue = Math.random() < 0.05 ?
        0.2 + Math.random() * 0.4 :
        0.2 + (Math.random() - 0.5) * 0.1
      break
  }

  // Keep within reasonable bounds (warning thresholds + margin)
  const margin = (threshold.warning.max - threshold.warning.min) * 0.1
  newValue = Math.max(
    threshold.warning.min - margin,
    Math.min(threshold.warning.max + margin, newValue)
  )

  return {
    timestamp: new Date().toISOString(),
    value: parseFloat(newValue.toFixed(2)),
    instrumentId,
    instrumentName
  }
}

/**
 * Check QC status for a given value and metric
 * Boundary semantics: min/max values are inclusive for "pass" status
 * - Pass: value is within [min, max] inclusive
 * - Warning: value is outside [min, max] but within warning thresholds
 * - Fail: value is outside warning thresholds
 */
export function checkQCStatus(value: number, metric: keyof MetricData): 'pass' | 'warning' | 'fail' {
  const threshold = THRESHOLDS_BY_METRIC[metric]
  if (!threshold) return 'pass'

  // Check if value is outside warning thresholds (fail condition)
  if (value < threshold.warning.min || value > threshold.warning.max) {
    return 'fail'
  }
  // Check if value is outside normal range but within warning (warning condition)
  if (value < threshold.min || value > threshold.max) {
    return 'warning'
  }
  // Value is within normal range (pass condition)
  return 'pass'
}

export const METRIC_UNITS: Record<keyof MetricData, string> = {
  temperature: '°C',
  pressure: 'kPa',
  flowRate: 'L/min',
  vibration: 'mm/s'
}

export const METRIC_DISPLAY_NAMES: Record<keyof MetricData, string> = {
  temperature: 'Temperature',
  pressure: 'Pressure',
  flowRate: 'Flow Rate',
  vibration: 'Vibration'
}

export const METRIC_COLORS: Record<keyof MetricData, string> = {
  temperature: '#ef4444', // red-500
  pressure: '#3b82f6', // blue-500
  flowRate: '#10b981', // emerald-500
  vibration: '#f59e0b' // amber-500
}