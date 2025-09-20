import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/security/session-helper';
import { validateCSRFToken } from '@/lib/security/csrf';
import crypto from 'crypto';

const ReportQuerySchema = z.object({
  dateRange: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  }),
  instruments: z.array(z.string()).optional(),
  projects: z.array(z.string()).optional(),
  statuses: z.array(z.enum(['passed', 'failed', 'warning'])).optional(),
  metrics: z.array(z.enum(['runs', 'fail_rate', 'runtime', 'qc_flags', 'samples'])).optional(),
  groupBy: z.enum(['day', 'instrument', 'project']).optional()
});

// Mock runs data for demo
const mockRuns = [
  {
    runId: 'run-001',
    instrument: { name: 'HPLC-01' },
    project: { name: 'Protein Analysis' },
    startedAt: new Date('2024-01-15T10:00:00Z'),
    durationMinutes: 45,
    status: 'passed',
    qcFlag: null,
    qcReason: null,
    samplesProcessed: 24
  },
  {
    runId: 'run-002',
    instrument: { name: 'Sequencer-A' },
    project: { name: 'Genomics Study' },
    startedAt: new Date('2024-01-15T14:30:00Z'),
    durationMinutes: 180,
    status: 'passed',
    qcFlag: 'warning',
    qcReason: 'Low quality reads in sample 5',
    samplesProcessed: 96
  },
  {
    runId: 'run-003',
    instrument: { name: 'LCMS-02' },
    project: { name: 'Metabolomics' },
    startedAt: new Date('2024-01-16T09:00:00Z'),
    durationMinutes: 120,
    status: 'failed',
    qcFlag: 'error',
    qcReason: 'Calibration drift detected',
    samplesProcessed: 48
  },
  {
    runId: 'run-004',
    instrument: { name: 'PCR-03' },
    project: { name: 'COVID Testing' },
    startedAt: new Date('2024-01-16T11:30:00Z'),
    durationMinutes: 90,
    status: 'passed',
    qcFlag: null,
    qcReason: null,
    samplesProcessed: 384
  },
  {
    runId: 'run-005',
    instrument: { name: 'HPLC-01' },
    project: { name: 'Drug Discovery' },
    startedAt: new Date('2024-01-17T08:00:00Z'),
    durationMinutes: 60,
    status: 'warning',
    qcFlag: 'warning',
    qcReason: 'Pressure fluctuation detected',
    samplesProcessed: 36
  }
];

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const csrfResult = validateCSRFToken(req, session.userId);
    if (!csrfResult.valid) {
      return NextResponse.json({ error: csrfResult.error || 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await req.json();
    const query = ReportQuerySchema.parse(body);

    const reportId = crypto.randomUUID();
    const startDate = new Date(query.dateRange.start);
    const endDate = new Date(query.dateRange.end);
    endDate.setHours(23, 59, 59, 999);

    // Filter mock runs based on query
    const filteredRuns = mockRuns.filter(run => {
      const inDateRange = run.startedAt >= startDate && run.startedAt <= endDate;
      const matchesInstrument = !query.instruments || query.instruments.includes(run.instrument.name);
      const matchesProject = !query.projects || query.projects.includes(run.project.name);
      const matchesStatus = !query.statuses || query.statuses.includes(run.status as any);

      return inDateRange && matchesInstrument && matchesProject && matchesStatus;
    });

    const totalRuns = filteredRuns.length;
    const failedRuns = filteredRuns.filter(r => r.status === 'failed').length;
    const failRate = totalRuns > 0 ? (failedRuns / totalRuns) * 100 : 0;
    const avgRuntimeMin = filteredRuns.length > 0
      ? filteredRuns.reduce((sum, r) => sum + (r.durationMinutes || 0), 0) / filteredRuns.length
      : 0;
    const qcFlags = filteredRuns.filter(r => r.qcFlag !== null).length;
    const samples = filteredRuns.reduce((sum, r) => sum + (r.samplesProcessed || 0), 0);

    // Generate runs by day
    const runsByDay: Record<string, { passed: number; failed: number }> = {};
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayStr = d.toISOString().split('T')[0];
      runsByDay[dayStr] = { passed: 0, failed: 0 };
    }

    filteredRuns.forEach(run => {
      const day = run.startedAt.toISOString().split('T')[0];
      if (runsByDay[day]) {
        if (run.status === 'passed') {
          runsByDay[day].passed++;
        } else if (run.status === 'failed') {
          runsByDay[day].failed++;
        }
      }
    });

    const failuresByInstrument: Record<string, number> = {};
    filteredRuns
      .filter(r => r.status === 'failed')
      .forEach(run => {
        const instrumentName = run.instrument?.name || 'Unknown';
        failuresByInstrument[instrumentName] = (failuresByInstrument[instrumentName] || 0) + 1;
      });

    const runtimeTrend = Object.keys(runsByDay).map(day => {
      const dayRuns = filteredRuns.filter(r =>
        r.startedAt.toISOString().split('T')[0] === day
      );
      const avgMinutes = dayRuns.length > 0
        ? dayRuns.reduce((sum, r) => sum + (r.durationMinutes || 0), 0) / dayRuns.length
        : 0;
      return { day, minutes: Math.round(avgMinutes) };
    });

    // Mock storing report in database
    // const reportRecord = {
    //   id: reportId,
    //   generatedBy: session.userId,
    //   query: query,
    //   checksum: crypto
    //     .createHash('sha256')
    //     .update(JSON.stringify(query))
    //     .digest('hex'),
    //   expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    //   createdAt: new Date().toISOString()
    // };

    const response = {
      id: reportId,
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
          .sort((a, b) => b.failed - a.failed)
          .slice(0, 10),
        runtimeTrend
      },
      table: filteredRuns.slice(0, 100).map(run => ({
        runId: run.runId,
        instrument: run.instrument?.name || 'Unknown',
        project: run.project?.name,
        startedAt: run.startedAt.toISOString(),
        durationMin: run.durationMinutes || 0,
        status: run.status as 'passed' | 'failed' | 'warning',
        qc: run.qcFlag ? {
          flag: run.qcFlag,
          reason: run.qcReason || undefined
        } : undefined
      }))
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Report preview error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to generate report preview' },
      { status: 500 }
    );
  }
}