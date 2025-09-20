'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  ArrowDownTrayIcon,
  EnvelopeIcon,
  ClockIcon,
  LinkIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';
import { ReportPreviewProps } from '@/types/reports';
import { format } from 'date-fns';

const COLORS = {
  passed: '#10b981',
  failed: '#ef4444',
  warning: '#f59e0b',
  primary: '#3b82f6',
  secondary: '#6b7280'
};

export function ReportPreview({
  reportId,
  filters,
  kpis,
  charts,
  tableData,
  onExport,
  onSchedule,
  onEmail
}: ReportPreviewProps) {
  const [selectedDateRange, setSelectedDateRange] = useState('custom');
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM d, yyyy');
  };

  const KpiCard = ({
    label,
    value,
    delta,
    unit
  }: {
    label: string;
    value: number | string;
    delta?: number;
    unit?: string;
  }) => (
    <Card className="border-gray-200">
      <CardContent className="p-4">
        <p className="text-sm font-medium text-gray-600">{label}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-gray-900">
            {value}{unit}
          </span>
          {delta !== undefined && delta !== 0 && (
            <span
              className={`flex items-center text-sm font-medium ${
                delta > 0 ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {delta > 0 ? (
                <ArrowUpIcon className="h-3 w-3" />
              ) : (
                <ArrowDownIcon className="h-3 w-3" />
              )}
              {Math.abs(delta)}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-sm font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const pieData = [
    { name: 'Passed', value: charts.passFail.passed },
    { name: 'Failed', value: charts.passFail.failed }
  ];

  const failRate = kpis.runs > 0 ? Math.round(kpis.failRate) : 0;

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <Card className="border-gray-200">
        <CardContent className="flex gap-4 p-4">
          <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">
                {formatDate(filters.dateRange.start)} - {formatDate(filters.dateRange.end)}
              </SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">Last 30 days</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="passed">Passed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onExport('csv')}>
              <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => onExport('pdf')}>
              <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => onEmail([])}>
              <EnvelopeIcon className="mr-2 h-4 w-4" />
              Email
            </Button>
            <Button variant="outline" size="sm" onClick={onSchedule}>
              <ClockIcon className="mr-2 h-4 w-4" />
              Schedule
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI Row */}
      <div className="grid grid-cols-5 gap-4">
        <KpiCard label="Total Runs" value={kpis.runs} />
        <KpiCard label="Fail Rate" value={kpis.failRate} unit="%" delta={2.1} />
        <KpiCard label="Avg Runtime" value={kpis.avgRuntimeMin} unit=" min" delta={-5} />
        <KpiCard label="QC Flags" value={kpis.qcFlags} delta={3} />
        <KpiCard label="Samples" value={kpis.samples.toLocaleString()} />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Runs by Day */}
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Runs by Day</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={charts.runsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => format(new Date(value), 'MMM d')}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="passed" stackId="a" fill={COLORS.passed} name="Passed" />
                <Bar dataKey="failed" stackId="a" fill={COLORS.failed} name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pass vs Fail Donut */}
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Pass vs Fail Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                >
                  <Cell fill={COLORS.passed} />
                  <Cell fill={COLORS.failed} />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 text-center">
              <p className="text-2xl font-semibold text-gray-900">{failRate}%</p>
              <p className="text-sm text-gray-600">Failure Rate</p>
            </div>
          </CardContent>
        </Card>

        {/* Top Failures by Instrument */}
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Top Failures by Instrument</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={charts.failuresByInstrument} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="instrument" type="category" tick={{ fontSize: 12 }} width={80} />
                <Tooltip />
                <Bar dataKey="failed" fill={COLORS.failed} name="Failed Runs" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Average Runtime Trend */}
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Average Runtime Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={charts.runtimeTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => format(new Date(value), 'MMM d')}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="minutes"
                  stroke={COLORS.primary}
                  strokeWidth={2}
                  dot={{ fill: COLORS.primary, r: 4 }}
                  name="Runtime (min)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Run Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Run ID</TableHead>
                  <TableHead>Instrument</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Started At</TableHead>
                  <TableHead className="text-right">Duration (min)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>QC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.slice(0, 10).map((run) => (
                  <TableRow key={run.runId}>
                    <TableCell className="font-mono text-sm">{run.runId}</TableCell>
                    <TableCell>{run.instrument}</TableCell>
                    <TableCell>{run.project || '-'}</TableCell>
                    <TableCell>{format(new Date(run.startedAt), 'MMM d, h:mm a')}</TableCell>
                    <TableCell className="text-right">{run.durationMin}</TableCell>
                    <TableCell>
                      <Badge
                        variant={run.status === 'passed' ? 'success' : 'destructive'}
                        className="text-xs"
                      >
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {run.qc ? (
                        <Badge variant="warning" className="text-xs">
                          {run.qc.flag}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {tableData.length > 10 && (
            <p className="mt-4 text-center text-sm text-gray-600">
              Showing 10 of {tableData.length} runs. Export CSV for full dataset.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="flex items-center justify-between border-t pt-4 text-sm text-gray-600">
        <span>Generated from chat request · Report ID: {reportId}</span>
        <Button variant="ghost" size="sm">
          <LinkIcon className="mr-2 h-4 w-4" />
          Copy Link
        </Button>
      </div>
    </div>
  );
}