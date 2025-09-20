# Report Generation Architecture - Antevus Lab Assistant

## Executive Summary
A chat-first, AI-powered report generation system that transforms natural language queries into beautiful, actionable lab reports with Recharts visualizations, CSV/PDF exports, and scheduled delivery.

## Core Features

### Natural Language Queries
- "Show all failed runs today"
- "List HPLC runs failed QC between 2025-09-01 and 2025-09-15 for Project A"
- "Generate this week's report for all instruments / qPCR + HPLC only"
- "Email the report to QA and export CSV"

## UX Flow: End-to-End Experience

### 1. Chat Initiation
User types natural language request → Assistant extracts intent + filters

### 2. Report Plan Card (Non-destructive Preview)
```
┌─────────────────────────────────────────────┐
│ Weekly Lab Summary · Sep 15–21              │
│                                              │
│ 📊 Scope                                     │
│ [HPLC] [qPCR] [Failed] [Project A]          │
│                                              │
│ 📈 Metrics                                   │
│ • Total runs & failure rate                  │
│ • Average runtime trends                     │
│ • QC exceptions                              │
│ • Throughput analysis                        │
│                                              │
│ 📤 Outputs                                   │
│ [On-screen] [CSV] [PDF] [Email: QA Team]    │
│                                              │
│ [Generate Report] [Edit Scope] [Cancel]      │
└─────────────────────────────────────────────┘
```

### 3. Report Preview (Side Panel/Drawer)
```
┌─────────────────────────────────────────────┐
│ Filters Bar                                  │
│ [Date: Sep 15-21 ▼] [Instruments ▼]         │
│ [Projects ▼] [Status: Failed ▼]              │
├─────────────────────────────────────────────┤
│ KPI Row                                      │
│ Total Runs  Fail Rate  Avg Runtime  QC Flags │
│    245        8.2%      45min         12     │
│             ↑2.1%      ↓5min        ↑3      │
├─────────────────────────────────────────────┤
│ Visualizations (Recharts)                    │
│ [Bar Chart] [Donut] [Line Chart] [HBar]      │
├─────────────────────────────────────────────┤
│ Data Table                                   │
│ [Sortable columns with sticky header]        │
├─────────────────────────────────────────────┤
│ Export Actions                               │
│ [Download CSV] [Download PDF] [Email]        │
│ [Copy Link] [Schedule Report]                │
└─────────────────────────────────────────────┘
```

## Technical Architecture

### Frontend Components

#### Core UI Components
```typescript
// Report Plan Card - Appears in chat thread
<ReportPlanCard
  title="Weekly Lab Summary"
  dateRange={{ start: "2025-09-15", end: "2025-09-21" }}
  scope={{ instruments: ["HPLC", "qPCR"], status: ["failed"] }}
  metrics={["runs", "fail_rate", "runtime", "qc_flags"]}
  outputs={["screen", "csv", "pdf", "email"]}
  onGenerate={handleGenerate}
  onEdit={handleEdit}
  onCancel={handleCancel}
/>

// Report Preview - Full page or drawer
<ReportPreview
  reportId={reportId}
  filters={filters}
  kpis={kpis}
  charts={chartData}
  tableData={runs}
  onExport={handleExport}
  onSchedule={handleSchedule}
/>

// KPI Statistics
<KpiStat
  label="Total Runs"
  value={245}
  delta={+12}
  deltaType="increase"
  caption="vs. last week"
/>

// Export Controls
<ExportButtons
  reportId={reportId}
  formats={["csv", "pdf"]}
  onExport={handleExport}
  onEmail={handleEmail}
  disabled={!reportId}
/>

// Schedule Modal
<ScheduleModal
  onConfirm={handleScheduleConfirm}
  presets={["Daily", "Weekly", "Monthly"]}
  customRRule={rrule}
/>
```

### Recharts Visualizations

#### 1. Runs by Day (Stacked Bar Chart)
```typescript
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={runsByDay}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="day" />
    <YAxis />
    <Tooltip content={<CustomTooltip />} />
    <Legend />
    <Bar dataKey="passed" stackId="a" fill="#10b981" />
    <Bar dataKey="failed" stackId="a" fill="#ef4444" />
  </BarChart>
</ResponsiveContainer>
```

#### 2. Pass vs Fail (Donut Chart)
```typescript
<ResponsiveContainer width="100%" height={300}>
  <PieChart>
    <Pie
      data={passFailData}
      cx="50%"
      cy="50%"
      innerRadius={60}
      outerRadius={80}
      paddingAngle={5}
      dataKey="value"
    >
      <Cell fill="#10b981" />
      <Cell fill="#ef4444" />
    </Pie>
    <Tooltip />
    <Legend />
  </PieChart>
</ResponsiveContainer>
```

#### 3. Average Runtime Trend (Line Chart)
```typescript
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={runtimeTrend}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="day" />
    <YAxis />
    <Tooltip />
    <Legend />
    <Line
      type="monotone"
      dataKey="minutes"
      stroke="#3b82f6"
      strokeWidth={2}
      dot={{ fill: '#3b82f6' }}
    />
  </LineChart>
</ResponsiveContainer>
```

#### 4. Top Failures by Instrument (Horizontal Bar)
```typescript
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={failuresByInstrument} layout="horizontal">
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis type="number" />
    <YAxis dataKey="instrument" type="category" />
    <Tooltip />
    <Bar dataKey="failed" fill="#ef4444" />
  </BarChart>
</ResponsiveContainer>
```

## Backend Architecture

### Data Contracts

```typescript
// Query Payload
interface ReportQuery {
  dateRange: {
    start: string; // ISO date
    end: string;   // ISO date
  };
  instruments?: string[];
  projects?: string[];
  statuses?: ("passed" | "failed" | "warning")[];
  metrics?: ("runs" | "fail_rate" | "runtime" | "qc_flags" | "samples")[];
  groupBy?: ("day" | "instrument" | "project");
}

// Preview Response
interface ReportPreviewDTO {
  id: string; // Temporary report ID
  kpis: {
    runs: number;
    failRate: number;
    avgRuntimeMin: number;
    qcFlags: number;
    samples: number;
  };
  series: {
    runsByDay: Array<{
      day: string;
      passed: number;
      failed: number;
    }>;
    passFail: {
      passed: number;
      failed: number;
    };
    failuresByInstrument: Array<{
      instrument: string;
      failed: number;
    }>;
    runtimeTrend: Array<{
      day: string;
      minutes: number;
    }>;
  };
  table: Array<{
    runId: string;
    instrument: string;
    project?: string;
    startedAt: string;
    durationMin: number;
    status: "passed" | "failed";
    qc?: {
      flag?: string;
      reason?: string;
    };
  }>;
}

// Export Request
interface ReportExportRequest {
  reportId: string;
  format: "csv" | "pdf";
  deliver?: {
    email?: string[];
  };
}

// Export Response
interface ReportExportResponse {
  url: string; // Signed URL
  emailed?: string[];
}
```

### API Endpoints

```typescript
// Preview report generation
POST /api/reports/preview
Body: ReportQuery
Response: ReportPreviewDTO

// Export report
POST /api/reports/export
Body: ReportExportRequest
Response: ReportExportResponse

// Schedule report
POST /api/reports/schedule
Body: {
  query: ReportQuery;
  rrule: string; // RFC 5545 RRULE
  delivery?: {
    email?: string[];
    slack?: string;
  };
}

// Get scheduled reports
GET /api/reports/schedules
Response: Array<ScheduledReport>

// Delete scheduled report
DELETE /api/reports/schedules/:id
```

### LLM Function Calling Integration

```javascript
const reportTools = [
  {
    name: "preview_report",
    description: "Generate a non-destructive preview from filters",
    parameters: {
      type: "object",
      properties: {
        dateRange: {
          type: "object",
          properties: {
            start: { type: "string", format: "date" },
            end: { type: "string", format: "date" }
          },
          required: ["start", "end"]
        },
        instruments: {
          type: "array",
          items: { type: "string" }
        },
        projects: {
          type: "array",
          items: { type: "string" }
        },
        statuses: {
          type: "array",
          items: {
            type: "string",
            enum: ["passed", "failed", "warning"]
          }
        }
      },
      required: ["dateRange"]
    }
  },
  {
    name: "export_report",
    description: "Export a previously previewed report",
    parameters: {
      type: "object",
      properties: {
        reportId: { type: "string" },
        format: {
          type: "string",
          enum: ["csv", "pdf"]
        },
        deliver: {
          type: "object",
          properties: {
            email: {
              type: "array",
              items: { type: "string", format: "email" }
            }
          }
        }
      },
      required: ["reportId", "format"]
    }
  },
  {
    name: "schedule_report",
    description: "Create a scheduled report with RRULE",
    parameters: {
      type: "object",
      properties: {
        query: { $ref: "#/definitions/ReportQuery" },
        rrule: { type: "string" }
      },
      required: ["query", "rrule"]
    }
  }
];
```

## Export Implementations

### CSV Export
```typescript
// Generate CSV with two files in ZIP
async function generateCSV(reportId: string): Promise<Buffer> {
  const report = await getReport(reportId);

  // Create ZIP with two CSVs
  const zip = new JSZip();

  // 1. Detailed runs CSV
  const runsCsv = generateRunsCsv(report.table);
  zip.file("runs.csv", runsCsv);

  // 2. Summary CSV
  const summaryCsv = generateSummaryCsv({
    kpis: report.kpis,
    series: report.series
  });
  zip.file("summary.csv", summaryCsv);

  // Generate ZIP
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  // Upload to S3 with signed URL
  const filename = `report_${report.dateRange.start}_to_${report.dateRange.end}_${org}.zip`;
  const url = await uploadToS3(zipBuffer, filename);

  return url;
}
```

### PDF Export
```typescript
// Server-side PDF generation
async function generatePDF(reportId: string): Promise<string> {
  const report = await getReport(reportId);

  // Render React component to HTML
  const html = ReactDOMServer.renderToString(
    <PDFTemplate report={report} />
  );

  // Use Puppeteer for PDF generation
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.setContent(html);
  await page.addStyleTag({ path: 'print.css' });

  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm' }
  });

  await browser.close();

  // Upload and return signed URL
  return uploadToS3(pdf, `report_${reportId}.pdf`);
}
```

## Database Schema

```sql
-- Reports table for audit and reproducibility
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  generated_by UUID NOT NULL REFERENCES users(id),
  query JSONB NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,

  INDEX idx_reports_org (organization_id),
  INDEX idx_reports_user (generated_by),
  INDEX idx_reports_created (created_at DESC)
);

-- Scheduled reports
CREATE TABLE scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  query JSONB NOT NULL,
  rrule VARCHAR(500) NOT NULL,
  delivery JSONB,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_scheduled_org (organization_id),
  INDEX idx_scheduled_next (next_run_at)
);

-- Report exports audit
CREATE TABLE report_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id),
  exported_by UUID NOT NULL REFERENCES users(id),
  format VARCHAR(10) NOT NULL,
  url VARCHAR(500),
  delivered_to JSONB,
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_exports_report (report_id),
  INDEX idx_exports_user (exported_by)
);
```

## Security & Compliance

### Access Control
```typescript
// Row-level security for reports
async function enforceReportAccess(
  userId: string,
  query: ReportQuery
): Promise<ReportQuery> {
  const user = await getUser(userId);
  const permissions = await getUserPermissions(userId);

  // Filter based on user's project access
  if (!permissions.includes('VIEW_ALL_PROJECTS')) {
    const allowedProjects = await getUserProjects(userId);
    query.projects = query.projects?.filter(p =>
      allowedProjects.includes(p)
    );
  }

  // Filter based on instrument access
  if (!permissions.includes('VIEW_ALL_INSTRUMENTS')) {
    const allowedInstruments = await getUserInstruments(userId);
    query.instruments = query.instruments?.filter(i =>
      allowedInstruments.includes(i)
    );
  }

  return query;
}
```

### Audit Logging
```typescript
// Log all report actions
async function auditReportAction(
  action: 'preview' | 'export' | 'schedule',
  userId: string,
  reportId: string,
  metadata?: any
): Promise<void> {
  await createAuditLog({
    resource_type: 'report',
    resource_id: reportId,
    action,
    user_id: userId,
    ip_address: getClientIP(),
    metadata,
    timestamp: new Date()
  });
}
```

## Performance Optimizations

### Query Optimization
```sql
-- Pre-aggregated daily metrics
CREATE MATERIALIZED VIEW daily_run_metrics AS
SELECT
  DATE(started_at) as day,
  instrument_id,
  project_id,
  status,
  COUNT(*) as run_count,
  AVG(duration_minutes) as avg_duration,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_minutes) as p95_duration,
  SUM(CASE WHEN qc_flag IS NOT NULL THEN 1 ELSE 0 END) as qc_flags,
  SUM(samples_processed) as total_samples
FROM runs
WHERE started_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY 1, 2, 3, 4;

-- Refresh every hour
CREATE INDEX idx_daily_metrics_day ON daily_run_metrics(day);
CREATE INDEX idx_daily_metrics_instrument ON daily_run_metrics(instrument_id);
```

### Caching Strategy
```typescript
// Cache report previews
const CACHE_TTL = 300; // 5 minutes

async function getReportPreview(query: ReportQuery): Promise<ReportPreviewDTO> {
  const cacheKey = `report:preview:${hashQuery(query)}`;

  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Generate report
  const report = await generateReportPreview(query);

  // Cache result
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(report));

  return report;
}
```

## Demo Dataset

### Sample Data Generation
```typescript
// Generate realistic demo data
function generateDemoRuns(): Run[] {
  const instruments = ['HPLC-01', 'HPLC-02', 'qPCR-01', 'Plate-Reader-01', 'Flow-01'];
  const projects = ['Project A', 'Project B', 'Research'];
  const runs: Run[] = [];

  // Generate 7 days of data
  for (let day = 0; day < 7; day++) {
    const date = new Date();
    date.setDate(date.getDate() - day);

    // 20-40 runs per day
    const runCount = Math.floor(Math.random() * 20) + 20;

    for (let i = 0; i < runCount; i++) {
      const instrument = instruments[Math.floor(Math.random() * instruments.length)];
      const project = projects[Math.floor(Math.random() * projects.length)];
      const isFailed = Math.random() < 0.12; // 12% failure rate
      const hasQCFlag = Math.random() < 0.05; // 5% QC flags

      runs.push({
        runId: `RUN-${date.toISOString().split('T')[0]}-${i.toString().padStart(3, '0')}`,
        instrument,
        project,
        startedAt: new Date(date.getTime() + Math.random() * 86400000),
        durationMin: Math.floor(Math.random() * 60) + 15,
        status: isFailed ? 'failed' : 'passed',
        qc: hasQCFlag ? {
          flag: 'WARNING',
          reason: 'Temperature deviation detected'
        } : undefined,
        samplesProcessed: Math.floor(Math.random() * 96) + 1
      });
    }
  }

  return runs;
}
```

## Testing Strategy

### Unit Tests
```typescript
describe('Report Generation', () => {
  test('should calculate fail rate correctly', () => {
    const runs = [
      { status: 'passed' },
      { status: 'failed' },
      { status: 'passed' },
      { status: 'failed' }
    ];
    expect(calculateFailRate(runs)).toBe(50);
  });

  test('should group runs by day', () => {
    const runs = generateTestRuns();
    const grouped = groupRunsByDay(runs);
    expect(grouped).toHaveLength(7);
    expect(grouped[0]).toHaveProperty('passed');
    expect(grouped[0]).toHaveProperty('failed');
  });

  test('should export CSV with correct columns', async () => {
    const report = generateTestReport();
    const csv = await generateCSV(report);
    expect(csv).toContain('runId,instrument,project,status');
  });
});
```

### E2E Tests
```typescript
describe('Report E2E Flow', () => {
  test('should generate report from chat request', async () => {
    // User asks in chat
    await sendChatMessage('Show failed runs today');

    // Verify plan card appears
    const planCard = await waitForElement('[data-testid="report-plan-card"]');
    expect(planCard).toBeVisible();

    // Click generate
    await click('[data-testid="generate-report"]');

    // Verify preview opens
    const preview = await waitForElement('[data-testid="report-preview"]');
    expect(preview).toBeVisible();

    // Export CSV
    await click('[data-testid="export-csv"]');

    // Verify download link
    const link = await waitForElement('[data-testid="download-link"]');
    expect(link).toHaveAttribute('href', expect.stringContaining('.zip'));
  });
});
```

## Deployment & Monitoring

### Performance Metrics
- Preview generation: P95 < 2s for 10k runs
- PDF generation: P95 < 5s
- CSV export: P95 < 3s for 50k rows
- Chart rendering: < 100ms per chart

### Monitoring Dashboard
```typescript
// Key metrics to track
const reportMetrics = {
  previews_generated: Counter,
  exports_completed: Counter,
  schedules_created: Counter,
  generation_time: Histogram,
  export_time: Histogram,
  failure_rate: Gauge
};

// Alert thresholds
const alerts = {
  high_failure_rate: threshold > 5%,
  slow_generation: p95 > 5s,
  export_errors: rate > 1/min
};
```

## Future Enhancements

### Phase 1 (MVP)
- Basic report generation
- CSV/PDF export
- Simple scheduling

### Phase 2
- Advanced filtering (regex, custom SQL)
- Comparison reports (week-over-week)
- Custom chart types
- Report templates

### Phase 3
- AI-powered insights
- Anomaly detection
- Predictive failure analysis
- Automated recommendations