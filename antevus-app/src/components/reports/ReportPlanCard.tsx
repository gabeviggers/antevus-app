'use client';

import { CalendarIcon, ChartBarIcon, BeakerIcon, ClockIcon, ChartPieIcon, FlagIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { ReportPlanCardProps } from '@/types/reports';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function ReportPlanCard({
  title,
  dateRange,
  scope,
  metrics,
  outputs,
  recipients,
  onGenerate,
  onEdit,
  onCancel
}: ReportPlanCardProps) {
  const formatDateRange = () => {
    const start = new Date(dateRange.start).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    const end = new Date(dateRange.end).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    return `${start} – ${end}`;
  };

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case 'runs':
        return <ChartBarIcon className="h-4 w-4" />;
      case 'fail_rate':
        return <ChartPieIcon className="h-4 w-4" />;
      case 'runtime':
        return <ClockIcon className="h-4 w-4" />;
      case 'qc_flags':
        return <FlagIcon className="h-4 w-4" />;
      case 'samples':
        return <BeakerIcon className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getMetricLabel = (metric: string) => {
    switch (metric) {
      case 'runs':
        return 'Total runs & failure rate';
      case 'fail_rate':
        return 'Pass/fail distribution';
      case 'runtime':
        return 'Average runtime trends';
      case 'qc_flags':
        return 'QC exceptions';
      case 'samples':
        return 'Throughput analysis';
      default:
        return metric;
    }
  };

  const getOutputIcon = (output: string) => {
    switch (output) {
      case 'screen':
        return '📊';
      case 'csv':
        return '📁';
      case 'pdf':
        return '📄';
      case 'email':
        return '📧';
      default:
        return '';
    }
  };

  return (
    <Card className="w-full max-w-2xl border-gray-200 bg-white shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">
            {title} · {formatDateRange()}
          </h3>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">📊 Scope</p>
          <div className="flex flex-wrap gap-1.5">
            {scope.instruments?.map(instrument => (
              <Badge key={instrument} variant="secondary" className="text-xs">
                {instrument}
              </Badge>
            ))}
            {scope.projects?.map(project => (
              <Badge key={project} variant="secondary" className="text-xs">
                {project}
              </Badge>
            ))}
            {scope.status?.map(status => (
              <Badge
                key={status}
                variant={status === 'failed' ? 'destructive' : 'secondary'}
                className="text-xs"
              >
                {status}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">📈 Metrics</p>
          <ul className="space-y-1">
            {metrics.map(metric => (
              <li key={metric} className="flex items-center gap-2 text-sm text-gray-600">
                {getMetricIcon(metric)}
                <span>{getMetricLabel(metric)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">📤 Outputs</p>
          <div className="flex gap-3">
            {outputs.map(output => (
              <div key={output} className="flex items-center gap-1 text-sm text-gray-600">
                <span>{getOutputIcon(output)}</span>
                <span className="capitalize">{output}</span>
              </div>
            ))}
          </div>
          {recipients && recipients.length > 0 && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
              <EnvelopeIcon className="h-4 w-4" />
              <span>Recipients: {recipients.join(', ')}</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 pt-4">
        <Button
          onClick={onGenerate}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Generate Report
        </Button>
        <Button
          onClick={onEdit}
          variant="outline"
        >
          Edit Scope
        </Button>
        <Button
          onClick={onCancel}
          variant="ghost"
        >
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}