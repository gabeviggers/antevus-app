import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { getServerSession } from '@/lib/security/session-helper';
import { validateCSRFToken } from '@/lib/security/csrf';
import { RRule } from 'rrule';
import crypto from 'crypto';

const ScheduleReportSchema = z.object({
  name: z.string().min(1).max(255),
  query: z.object({
    dateRange: z.object({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    }),
    instruments: z.array(z.string()).optional(),
    projects: z.array(z.string()).optional(),
    statuses: z.array(z.enum(['passed', 'failed', 'warning'])).optional(),
    metrics: z.array(z.enum(['runs', 'fail_rate', 'runtime', 'qc_flags', 'samples'])).optional(),
    groupBy: z.enum(['day', 'instrument', 'project']).optional()
  }),
  rrule: z.string(),
  delivery: z.object({
    email: z.array(z.string().email()).optional(),
    slack: z.string().optional()
  }).optional()
});

// Mock storage for scheduled reports (in production, use database)
interface ScheduledReport {
  id: string;
  createdBy: string;
  name: string;
  query: {
    dateRange: { start: string; end: string };
    instruments?: string[];
    projects?: string[];
    statuses?: ('passed' | 'failed' | 'warning')[];
    metrics?: ('runs' | 'fail_rate' | 'runtime' | 'qc_flags' | 'samples')[];
    groupBy?: 'day' | 'instrument' | 'project';
  };
  rrule: string;
  delivery: {
    email?: string[];
    slack?: string;
  };
  nextRunAt: Date;
  enabled: boolean;
  createdAt: Date;
  lastRunAt: Date | null;
}

const scheduledReports: Map<string, ScheduledReport> = new Map();

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
    const scheduleRequest = ScheduleReportSchema.parse(body);

    // Validate RRULE
    let nextRunAt: Date;
    try {
      const rule = RRule.fromString(scheduleRequest.rrule);
      const nextOccurrence = rule.after(new Date());
      if (!nextOccurrence) {
        return NextResponse.json(
          { error: 'Invalid schedule: no future occurrences' },
          { status: 400 }
        );
      }
      nextRunAt = nextOccurrence;
    } catch (_error) {
      return NextResponse.json(
        { error: 'Invalid RRULE format' },
        { status: 400 }
      );
    }

    // Mock creating scheduled report
    const scheduledReport = {
      id: crypto.randomUUID(),
      createdBy: session.userId,
      name: scheduleRequest.name,
      query: scheduleRequest.query,
      rrule: scheduleRequest.rrule,
      delivery: scheduleRequest.delivery || {},
      nextRunAt,
      enabled: true,
      createdAt: new Date(),
      lastRunAt: null
    };

    // Store in mock storage
    scheduledReports.set(scheduledReport.id, scheduledReport);

    return NextResponse.json({
      id: scheduledReport.id,
      name: scheduledReport.name,
      query: scheduledReport.query,
      rrule: scheduledReport.rrule,
      delivery: scheduledReport.delivery,
      nextRunAt: scheduledReport.nextRunAt.toISOString(),
      enabled: scheduledReport.enabled,
      createdBy: session.userId,
      createdAt: scheduledReport.createdAt.toISOString()
    });
  } catch (_error) {
    logger.error('Schedule report error', {
      error: _error instanceof Error ? _error.message : String(_error)
    });
    if (_error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: _error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to schedule report' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return mock scheduled reports
    const mockScheduledReports: unknown[] = [
      {
        id: 'sched-001',
        name: 'Weekly Lab Report',
        query: {
          dateRange: { start: '2024-01-01', end: '2024-01-07' },
          instruments: ['HPLC-01', 'Sequencer-A'],
          statuses: ['passed', 'failed']
        },
        rrule: 'FREQ=WEEKLY;INTERVAL=1',
        delivery: { email: ['lab@example.com'] },
        lastRunAt: new Date('2024-01-07T00:00:00Z').toISOString(),
        nextRunAt: new Date('2024-01-14T00:00:00Z').toISOString(),
        enabled: true,
        createdBy: session.userId,
        createdAt: new Date('2024-01-01T00:00:00Z').toISOString()
      },
      {
        id: 'sched-002',
        name: 'Daily QC Summary',
        query: {
          dateRange: { start: '2024-01-15', end: '2024-01-15' },
          metrics: ['qc_flags', 'fail_rate']
        },
        rrule: 'FREQ=DAILY;INTERVAL=1',
        delivery: { slack: '#lab-reports' },
        lastRunAt: new Date('2024-01-15T06:00:00Z').toISOString(),
        nextRunAt: new Date('2024-01-16T06:00:00Z').toISOString(),
        enabled: true,
        createdBy: session.userId,
        createdAt: new Date('2024-01-01T00:00:00Z').toISOString()
      }
    ];

    // Add any reports from mock storage - filtered by current user
    Array.from(scheduledReports.values())
      .filter(report => report.createdBy === session.userId)
      .forEach(report => {
        mockScheduledReports.push({
          id: report.id,
          name: report.name,
          query: report.query as {
            dateRange: { start: string; end: string };
            instruments?: string[];
            projects?: string[];
            statuses?: string[];
            metrics?: string[];
          },
          rrule: report.rrule,
          delivery: report.delivery as { email?: string[]; slack?: string },
          lastRunAt: report.lastRunAt?.toISOString() || null,
          nextRunAt: report.nextRunAt.toISOString(),
          enabled: report.enabled,
          createdBy: report.createdBy,
          createdAt: report.createdAt.toISOString()
        });
      });

    return NextResponse.json(mockScheduledReports);
  } catch (_error) {
    logger.error('Get scheduled reports error', {
      error: _error instanceof Error ? _error.message : String(_error)
    });
    return NextResponse.json(
      { error: 'Failed to retrieve scheduled reports' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const csrfResult = validateCSRFToken(req, session.userId);
    if (!csrfResult.valid) {
      return NextResponse.json({ error: csrfResult.error || 'Invalid CSRF token' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Report ID is required' },
        { status: 400 }
      );
    }

    // Define seeded demo report IDs that cannot be deleted
    const seededDemoIds = ['sched-001', 'sched-002'];

    // Check if it's a seeded demo report - these cannot be deleted
    if (seededDemoIds.includes(id)) {
      return NextResponse.json(
        { error: 'Cannot delete seeded demo reports' },
        { status: 403 }
      );
    }

    // Try to find the report in mock storage
    const report = scheduledReports.get(id);

    // Report not found
    if (!report) {
      return NextResponse.json(
        { error: 'Scheduled report not found' },
        { status: 404 }
      );
    }

    // Check ownership - user can only delete their own reports
    if (report.createdBy !== session.userId) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this report' },
        { status: 403 }
      );
    }

    // All checks passed - delete the report
    scheduledReports.delete(id);

    return NextResponse.json({ success: true, message: 'Scheduled report deleted successfully' });
  } catch (_error) {
    logger.error('Delete scheduled report error', {
      error: _error instanceof Error ? _error.message : String(_error)
    });
    return NextResponse.json(
      { error: 'Failed to delete scheduled report' },
      { status: 500 }
    );
  }
}