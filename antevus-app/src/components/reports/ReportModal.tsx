'use client';

import { useEffect, useState } from 'react';
import { X, Download, Calendar, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReportPreview } from './ReportPreview';
import { generateDemoReportData } from '@/lib/demo-data/report-demo';
import type { ReportPlan, ReportPreviewDTO } from '@/types/reports';
import { logger } from '@/lib/logger';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportPlan: ReportPlan;
}

export function ReportModal({ isOpen, onClose, reportPlan }: ReportModalProps) {
  const [reportData, setReportData] = useState<ReportPreviewDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      // Simulate API call to generate report
      setIsLoading(true);
      setTimeout(() => {
        const data = generateDemoReportData();
        setReportData(data);
        setIsLoading(false);
      }, 1500);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal/Drawer */}
      <div className="absolute right-0 top-0 h-full w-full md:w-[80%] lg:w-[70%] xl:w-[60%] bg-background shadow-xl transform transition-transform">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{reportPlan.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {reportPlan.scope.dateRange} • {reportPlan.scope.instruments.join(', ')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon">
                <Mail className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Calendar className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-5rem)] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-4">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Generating report...</p>
              </div>
            </div>
          ) : reportData ? (
            <ReportPreview
              reportId={`report-${Date.now()}`}
              filters={{
                dateRange: { start: '2025-09-14', end: '2025-09-20' },
                instruments: reportPlan.scope.instruments,
                statuses: reportPlan.scope.filters.includes('Status: Failed') ? ['failed'] : undefined
              }}
              kpis={reportData.kpis}
              charts={{
                runsByDay: reportData.series.runsByDay,
                passFail: reportData.series.passFail,
                failuresByInstrument: reportData.series.failuresByInstrument,
                runtimeTrend: reportData.series.runtimeTrend
              }}
              tableData={reportData.table}
              onExport={(format) => {
                logger.info('Exporting report', { format });
                // Implement export functionality
              }}
              onSchedule={() => {
                logger.info('Opening schedule modal');
                // Implement schedule functionality
              }}
              onEmail={(email) => {
                logger.info('Emailing report', { email });
                // Implement email functionality
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}