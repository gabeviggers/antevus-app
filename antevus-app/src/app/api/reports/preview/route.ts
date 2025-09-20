import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth-helper';
import { prisma } from '@/lib/prisma';
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

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await validateCSRFToken(req);

    const body = await req.json();
    const query = ReportQuerySchema.parse(body);

    const reportId = crypto.randomUUID();
    const startDate = new Date(query.dateRange.start);
    const endDate = new Date(query.dateRange.end);
    endDate.setHours(23, 59, 59, 999);

    const runs = await prisma.run.findMany({
      where: {
        organizationId: session.user.organizationId,
        startedAt: {
          gte: startDate,
          lte: endDate
        },
        ...(query.instruments && {
          instrumentId: { in: query.instruments }
        }),
        ...(query.projects && {
          projectId: { in: query.projects }
        }),
        ...(query.statuses && {
          status: { in: query.statuses }
        })
      },
      include: {
        instrument: true,
        project: true
      }
    });

    const totalRuns = runs.length;
    const failedRuns = runs.filter(r => r.status === 'failed').length;
    const failRate = totalRuns > 0 ? (failedRuns / totalRuns) * 100 : 0;
    const avgRuntimeMin = runs.length > 0
      ? runs.reduce((sum, r) => sum + (r.durationMinutes || 0), 0) / runs.length
      : 0;
    const qcFlags = runs.filter(r => r.qcFlag !== null).length;
    const samples = runs.reduce((sum, r) => sum + (r.samplesProcessed || 0), 0);

    const runsByDay: Record<string, { passed: number; failed: number }> = {};
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayStr = d.toISOString().split('T')[0];
      runsByDay[dayStr] = { passed: 0, failed: 0 };
    }

    runs.forEach(run => {
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
    runs
      .filter(r => r.status === 'failed')
      .forEach(run => {
        const instrumentName = run.instrument?.name || 'Unknown';
        failuresByInstrument[instrumentName] = (failuresByInstrument[instrumentName] || 0) + 1;
      });

    const runtimeTrend = Object.keys(runsByDay).map(day => {
      const dayRuns = runs.filter(r =>
        r.startedAt.toISOString().split('T')[0] === day
      );
      const avgMinutes = dayRuns.length > 0
        ? dayRuns.reduce((sum, r) => sum + (r.durationMinutes || 0), 0) / dayRuns.length
        : 0;
      return { day, minutes: Math.round(avgMinutes) };
    });

    await prisma.report.create({
      data: {
        id: reportId,
        organizationId: session.user.organizationId,
        generatedBy: session.user.id,
        query: query as any,
        checksum: crypto
          .createHash('sha256')
          .update(JSON.stringify(query))
          .digest('hex'),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });

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
      table: runs.slice(0, 100).map(run => ({
        runId: run.id,
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
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to generate report preview' },
      { status: 500 }
    );
  }
}