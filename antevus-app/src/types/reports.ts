export interface ReportPlan {
  title: string;
  description: string;
  scope: {
    instruments: string[];
    dateRange: string;
    filters: string[];
  };
  metrics: string[];
  outputs: string[];
}

export interface ReportQuery {
  dateRange: {
    start: string;
    end: string;
  };
  instruments?: string[];
  projects?: string[];
  statuses?: ('passed' | 'failed' | 'warning')[];
  metrics?: ('runs' | 'fail_rate' | 'runtime' | 'qc_flags' | 'samples')[];
  groupBy?: 'day' | 'instrument' | 'project';
}

export interface ReportKPIs {
  runs: number;
  failRate: number;
  avgRuntimeMin: number;
  qcFlags: number;
  samples: number;
}

export interface RunsByDay {
  day: string;
  passed: number;
  failed: number;
}

export interface PassFailSummary {
  passed: number;
  failed: number;
}

export interface InstrumentFailures {
  instrument: string;
  failed: number;
}

export interface RuntimeTrend {
  day: string;
  minutes: number;
}

export interface ReportRun {
  runId: string;
  instrument: string;
  project?: string;
  startedAt: string;
  durationMin: number;
  status: 'passed' | 'failed' | 'warning';
  qc?: {
    flag?: string;
    reason?: string;
  };
}

export interface ReportPreviewDTO {
  id: string;
  kpis: ReportKPIs;
  series: {
    runsByDay: RunsByDay[];
    passFail: PassFailSummary;
    failuresByInstrument: InstrumentFailures[];
    runtimeTrend: RuntimeTrend[];
  };
  table: ReportRun[];
}

export interface ReportExportRequest {
  reportId: string;
  format: 'csv' | 'pdf';
  deliver?: {
    email?: string[];
  };
}

export interface ReportExportResponse {
  url: string;
  emailed?: string[];
}

export interface ScheduledReport {
  id: string;
  name: string;
  query: ReportQuery;
  rrule: string;
  delivery?: {
    email?: string[];
    slack?: string;
  };
  lastRunAt?: string;
  nextRunAt: string;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
}

export interface ReportPlanCardProps {
  title: string;
  dateRange: {
    start: string;
    end: string;
  };
  scope: {
    instruments?: string[];
    projects?: string[];
    status?: ('passed' | 'failed' | 'warning')[];
  };
  metrics: string[];
  outputs: ('screen' | 'csv' | 'pdf' | 'email')[];
  recipients?: string[];
  onGenerate: () => void;
  onEdit: () => void;
  onCancel: () => void;
}

export interface ReportPreviewProps {
  reportId: string;
  filters: ReportQuery;
  kpis: ReportKPIs;
  charts: {
    runsByDay: RunsByDay[];
    passFail: PassFailSummary;
    failuresByInstrument: InstrumentFailures[];
    runtimeTrend: RuntimeTrend[];
  };
  tableData: ReportRun[];
  onExport: (format: 'csv' | 'pdf') => void;
  onSchedule: () => void;
  onEmail: (recipients: string[]) => void;
}