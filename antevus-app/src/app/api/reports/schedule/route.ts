import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth-helper';
import { prisma } from '@/lib/prisma';
import { validateCSRFToken } from '@/lib/security/csrf';
import { RRule } from 'rrule';

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

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await validateCSRFToken(req);

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
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid RRULE format' },
        { status: 400 }
      );
    }

    const scheduledReport = await prisma.scheduledReport.create({
      data: {
        organizationId: session.user.organizationId,
        createdBy: session.user.id,
        name: scheduleRequest.name,
        query: scheduleRequest.query as any,
        rrule: scheduleRequest.rrule,
        delivery: scheduleRequest.delivery || {},
        nextRunAt,
        enabled: true
      }
    });

    return NextResponse.json({
      id: scheduledReport.id,
      name: scheduledReport.name,
      query: scheduledReport.query,
      rrule: scheduledReport.rrule,
      delivery: scheduledReport.delivery,
      nextRunAt: scheduledReport.nextRunAt.toISOString(),
      enabled: scheduledReport.enabled,
      createdBy: session.user.id,
      createdAt: scheduledReport.createdAt.toISOString()
    });
  } catch (error) {
    console.error('Schedule report error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
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
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scheduledReports = await prisma.scheduledReport.findMany({
      where: {
        organizationId: session.user.organizationId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(
      scheduledReports.map(report => ({
        id: report.id,
        name: report.name,
        query: report.query,
        rrule: report.rrule,
        delivery: report.delivery,
        lastRunAt: report.lastRunAt?.toISOString(),
        nextRunAt: report.nextRunAt.toISOString(),
        enabled: report.enabled,
        createdBy: report.createdBy,
        createdAt: report.createdAt.toISOString()
      }))
    );
  } catch (error) {
    console.error('Get scheduled reports error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve scheduled reports' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await validateCSRFToken(req);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Report ID is required' },
        { status: 400 }
      );
    }

    const report = await prisma.scheduledReport.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId
      }
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Scheduled report not found' },
        { status: 404 }
      );
    }

    await prisma.scheduledReport.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete scheduled report error:', error);
    return NextResponse.json(
      { error: 'Failed to delete scheduled report' },
      { status: 500 }
    );
  }
}