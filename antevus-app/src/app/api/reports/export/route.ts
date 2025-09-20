import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth-helper';
import { prisma } from '@/lib/prisma';
import { validateCSRFToken } from '@/lib/security/csrf';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import JSZip from 'jszip';
import Papa from 'papaparse';

const ExportRequestSchema = z.object({
  reportId: z.string().uuid(),
  format: z.enum(['csv', 'pdf']),
  deliver: z.object({
    email: z.array(z.string().email()).optional()
  }).optional()
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await validateCSRFToken(req);

    const body = await req.json();
    const exportRequest = ExportRequestSchema.parse(body);

    const report = await prisma.report.findFirst({
      where: {
        id: exportRequest.reportId,
        organizationId: session.user.organizationId
      }
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const query = report.query as any;
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
      },
      orderBy: {
        startedAt: 'desc'
      }
    });

    let url: string;

    if (exportRequest.format === 'csv') {
      const zip = new JSZip();

      const runsData = runs.map(run => ({
        runId: run.id,
        instrument: run.instrument?.name || 'Unknown',
        project: run.project?.name || '',
        startedAt: run.startedAt.toISOString(),
        durationMin: run.durationMinutes || 0,
        status: run.status,
        qcFlag: run.qcFlag || '',
        qcReason: run.qcReason || '',
        samplesProcessed: run.samplesProcessed || 0
      }));

      const runsCsv = Papa.unparse(runsData);
      zip.file('runs.csv', runsCsv);

      const totalRuns = runs.length;
      const failedRuns = runs.filter(r => r.status === 'failed').length;

      const summaryData = [{
        metric: 'Total Runs',
        value: totalRuns
      }, {
        metric: 'Failed Runs',
        value: failedRuns
      }, {
        metric: 'Pass Rate',
        value: `${Math.round((1 - failedRuns / totalRuns) * 100)}%`
      }, {
        metric: 'Average Runtime (min)',
        value: Math.round(runs.reduce((sum, r) => sum + (r.durationMinutes || 0), 0) / runs.length)
      }, {
        metric: 'QC Flags',
        value: runs.filter(r => r.qcFlag).length
      }, {
        metric: 'Total Samples',
        value: runs.reduce((sum, r) => sum + (r.samplesProcessed || 0), 0)
      }];

      const summaryCsv = Papa.unparse(summaryData);
      zip.file('summary.csv', summaryCsv);

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      const org = await prisma.organization.findUnique({
        where: { id: session.user.organizationId }
      });

      const filename = `reports/report_${query.dateRange.start}_to_${query.dateRange.end}_${org?.slug || 'export'}.zip`;

      const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: filename,
        Body: zipBuffer,
        ContentType: 'application/zip'
      });

      await s3Client.send(command);

      url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    } else {
      return NextResponse.json(
        { error: 'PDF export not yet implemented' },
        { status: 501 }
      );
    }

    await prisma.reportExport.create({
      data: {
        reportId: exportRequest.reportId,
        exportedBy: session.user.id,
        format: exportRequest.format,
        url,
        deliveredTo: exportRequest.deliver?.email || []
      }
    });

    if (exportRequest.deliver?.email) {
      console.log('Would send email to:', exportRequest.deliver.email);
    }

    return NextResponse.json({
      url,
      emailed: exportRequest.deliver?.email
    });
  } catch (error) {
    console.error('Report export error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to export report' },
      { status: 500 }
    );
  }
}