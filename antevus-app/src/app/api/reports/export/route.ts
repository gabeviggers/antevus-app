import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { getServerSession } from '@/lib/security/session-helper';
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

// Mock data for demo purposes
const mockRunsData = [
  {
    runId: 'run-001',
    instrument: 'HPLC-01',
    project: 'Protein Analysis',
    startedAt: new Date('2024-01-15T10:00:00Z').toISOString(),
    durationMin: 45,
    status: 'passed',
    qcFlag: '',
    qcReason: '',
    samplesProcessed: 24
  },
  {
    runId: 'run-002',
    instrument: 'Sequencer-A',
    project: 'Genomics Study',
    startedAt: new Date('2024-01-15T14:30:00Z').toISOString(),
    durationMin: 180,
    status: 'passed',
    qcFlag: 'warning',
    qcReason: 'Low quality reads in sample 5',
    samplesProcessed: 96
  },
  {
    runId: 'run-003',
    instrument: 'LCMS-02',
    project: 'Metabolomics',
    startedAt: new Date('2024-01-16T09:00:00Z').toISOString(),
    durationMin: 120,
    status: 'failed',
    qcFlag: 'error',
    qcReason: 'Calibration drift detected',
    samplesProcessed: 48
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
    const exportRequest = ExportRequestSchema.parse(body);

    let url: string;

    if (exportRequest.format === 'csv') {
      const zip = new JSZip();

      // Generate CSV files
      const runsCsv = Papa.unparse(mockRunsData);
      zip.file('runs.csv', runsCsv);

      const summaryData = [{
        metric: 'Total Runs',
        value: mockRunsData.length
      }, {
        metric: 'Failed Runs',
        value: mockRunsData.filter(r => r.status === 'failed').length
      }, {
        metric: 'Pass Rate',
        value: `${Math.round((mockRunsData.filter(r => r.status === 'passed').length / mockRunsData.length) * 100)}%`
      }, {
        metric: 'Average Runtime (min)',
        value: Math.round(mockRunsData.reduce((sum, r) => sum + r.durationMin, 0) / mockRunsData.length)
      }, {
        metric: 'QC Flags',
        value: mockRunsData.filter(r => r.qcFlag).length
      }, {
        metric: 'Total Samples',
        value: mockRunsData.reduce((sum, r) => sum + r.samplesProcessed, 0)
      }];

      const summaryCsv = Papa.unparse(summaryData);
      zip.file('summary.csv', summaryCsv);

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      // For demo purposes, return a data URL instead of using S3
      // In production, this would upload to S3
      if (process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET_NAME) {
        const filename = `reports/report_${Date.now()}_export.zip`;

        const command = new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME!,
          Key: filename,
          Body: zipBuffer,
          ContentType: 'application/zip'
        });

        await s3Client.send(command);
        url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      } else {
        // For local development without AWS credentials
        const base64 = zipBuffer.toString('base64');
        url = `data:application/zip;base64,${base64}`;
      }

    } else {
      return NextResponse.json(
        { error: 'PDF export not yet implemented' },
        { status: 501 }
      );
    }

    // Mock storing export record (would use Prisma in production)
    // const exportRecord = {
    //   id: exportRequest.reportId,
    //   exportedBy: session.userId,
    //   format: exportRequest.format,
    //   url,
    //   deliveredTo: exportRequest.deliver?.email || [],
    //   createdAt: new Date().toISOString()
    // };

    if (exportRequest.deliver?.email) {
      logger.info('Would send email', { recipients: exportRequest.deliver.email });
    }

    return NextResponse.json({
      url,
      emailed: exportRequest.deliver?.email
    });
  } catch (error) {
    logger.error('Report export error', {
      error: error instanceof Error ? error.message : String(error)
    });
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to export report' },
      { status: 500 }
    );
  }
}