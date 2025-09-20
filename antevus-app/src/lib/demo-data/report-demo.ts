import { ReportPreviewDTO, ReportRun } from '@/types/reports';

export function generateDemoReportData(): ReportPreviewDTO {
  const instruments = ['HPLC-01', 'HPLC-02', 'qPCR-01', 'Plate-Reader-01', 'Flow-01'];
  const projects = ['Project Alpha', 'Project Beta', 'Research Study X'];
  const qcReasons = [
    'Temperature deviation detected',
    'Calibration warning',
    'Sample volume below threshold',
    'Pressure spike observed',
    'Runtime exceeded limit'
  ];

  // Generate 7 days of runs
  const runs: ReportRun[] = [];
  const today = new Date();
  const runsByDay: Record<string, { passed: number; failed: number }> = {};
  const failuresByInstrument: Record<string, number> = {};

  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const date = new Date(today);
    date.setDate(date.getDate() - dayOffset);
    const dayStr = date.toISOString().split('T')[0];

    runsByDay[dayStr] = { passed: 0, failed: 0 };

    // Generate 20-40 runs per day
    const runCount = Math.floor(Math.random() * 20) + 20;

    for (let i = 0; i < runCount; i++) {
      const instrument = instruments[Math.floor(Math.random() * instruments.length)];
      const project = projects[Math.floor(Math.random() * projects.length)];

      // Higher failure rate for specific instruments to create "spiky" data
      const baseFailRate = instrument === 'HPLC-02' || instrument === 'qPCR-01' ? 0.2 : 0.08;
      const isFailed = Math.random() < baseFailRate;
      const hasQCFlag = Math.random() < 0.05;

      const startTime = new Date(date);
      startTime.setHours(Math.floor(Math.random() * 24));
      startTime.setMinutes(Math.floor(Math.random() * 60));

      const run: ReportRun = {
        runId: `RUN-${dayStr}-${i.toString().padStart(3, '0')}`,
        instrument,
        project,
        startedAt: startTime.toISOString(),
        durationMin: Math.floor(Math.random() * 60) + 15,
        status: isFailed ? 'failed' : 'passed',
        qc: hasQCFlag ? {
          flag: 'WARNING',
          reason: qcReasons[Math.floor(Math.random() * qcReasons.length)]
        } : undefined
      };

      runs.push(run);

      // Update aggregates
      if (isFailed) {
        runsByDay[dayStr].failed++;
        failuresByInstrument[instrument] = (failuresByInstrument[instrument] || 0) + 1;
      } else {
        runsByDay[dayStr].passed++;
      }
    }
  }

  // Calculate KPIs
  const totalRuns = runs.length;
  const failedRuns = runs.filter(r => r.status === 'failed').length;
  const failRate = (failedRuns / totalRuns) * 100;
  const avgRuntimeMin = runs.reduce((sum, r) => sum + r.durationMin, 0) / runs.length;
  const qcFlags = runs.filter(r => r.qc !== undefined).length;
  const samples = runs.length * Math.floor(Math.random() * 48 + 48); // 48-96 samples per run

  // Create runtime trend
  const runtimeTrend = Object.keys(runsByDay).map(day => {
    const dayRuns = runs.filter(r => r.startedAt.startsWith(day));
    const avgMinutes = dayRuns.length > 0
      ? dayRuns.reduce((sum, r) => sum + r.durationMin, 0) / dayRuns.length
      : 0;
    return { day, minutes: Math.round(avgMinutes) };
  });

  return {
    id: 'demo-report-' + Date.now(),
    kpis: {
      runs: totalRuns,
      failRate: Math.round(failRate * 10) / 10,
      avgRuntimeMin: Math.round(avgRuntimeMin),
      qcFlags,
      samples
    },
    series: {
      runsByDay: Object.entries(runsByDay).map(([day, data]) => ({
        day,
        ...data
      })),
      passFail: {
        passed: totalRuns - failedRuns,
        failed: failedRuns
      },
      failuresByInstrument: Object.entries(failuresByInstrument)
        .map(([instrument, failed]) => ({ instrument, failed }))
        .sort((a, b) => b.failed - a.failed),
      runtimeTrend
    },
    table: runs.sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )
  };
}

// Demo chat exemplars for testing
export const reportChatExamples = [
  {
    user: "Show failed runs today",
    assistant: {
      text: "I'll generate a report showing all failed runs from today.",
      reportPlan: {
        title: "Failed Runs Report",
        dateRange: { start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] },
        scope: { status: ['failed'] },
        metrics: ['runs', 'fail_rate', 'runtime', 'qc_flags'],
        outputs: ['screen', 'csv']
      }
    }
  },
  {
    user: "All HPLC failures between Sep 1-15 for Project A. Export CSV.",
    assistant: {
      text: "I'll create a report for HPLC failures between September 1-15 for Project A and prepare it for CSV export.",
      reportPlan: {
        title: "HPLC Failure Analysis",
        dateRange: { start: "2025-09-01", end: "2025-09-15" },
        scope: {
          instruments: ['HPLC-01', 'HPLC-02'],
          projects: ['Project A'],
          status: ['failed']
        },
        metrics: ['runs', 'fail_rate', 'runtime', 'qc_flags'],
        outputs: ['screen', 'csv']
      }
    }
  },
  {
    user: "Generate this week's qPCR + Plate Reader report and email QA team",
    assistant: {
      text: "I'll generate this week's report for qPCR and Plate Reader instruments and prepare it for email delivery to the QA team.",
      reportPlan: {
        title: "Weekly Lab Summary",
        dateRange: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0]
        },
        scope: {
          instruments: ['qPCR-01', 'Plate-Reader-01']
        },
        metrics: ['runs', 'fail_rate', 'runtime', 'qc_flags', 'samples'],
        outputs: ['screen', 'pdf', 'email'],
        recipients: ['qa-team@lab.com']
      }
    }
  }
];