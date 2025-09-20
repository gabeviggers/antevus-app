'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, Mail, Share2, Calendar, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateDemoReportData } from '@/lib/demo-data/report-demo';
import { format } from 'date-fns';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const COLORS = {
  passed: '#10b981',
  failed: '#ef4444',
  warning: '#f59e0b',
  primary: '#3b82f6',
  secondary: '#8b5cf6'
};

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching report data
    setTimeout(() => {
      const data = generateDemoReportData();
      setReportData({
        id: params.id,
        title: 'Weekly Lab Performance Report',
        dateRange: { start: '2025-09-14', end: '2025-09-20' },
        generatedAt: new Date().toISOString(),
        requestedBy: 'gabeviggers@gmail.com',
        instruments: ['HPLC-001', 'MS-002', 'PCR-003'],
        ...data
      });
      setIsLoading(false);
    }, 1000);
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading report...</p>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Report not found</h2>
          <Button onClick={() => router.push('/assistant')} variant="outline">
            Return to Lab Assistant
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/assistant')}
                className="rounded-full"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold">{reportData.title}</h1>
                <p className="text-xs text-muted-foreground">
                  Report ID: {params.id}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Share2 className="h-4 w-4" />
                Share
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Mail className="h-4 w-4" />
                Email
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Report Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Report Metadata */}
        <div className="bg-card rounded-lg border p-6 mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Date Range</p>
              <p className="text-sm font-medium">
                {format(new Date(reportData.dateRange.start), 'MMM dd')} - {format(new Date(reportData.dateRange.end), 'MMM dd, yyyy')}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Generated</p>
              <p className="text-sm font-medium">
                {format(new Date(reportData.generatedAt), 'MMM dd, yyyy h:mm a')}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Requested By</p>
              <p className="text-sm font-medium">{reportData.requestedBy}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Instruments</p>
              <p className="text-sm font-medium">{reportData.instruments.join(', ')}</p>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-card rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Runs</p>
            <p className="text-2xl font-bold">{reportData.kpis.runs}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-1">Success Rate</p>
            <p className="text-2xl font-bold text-green-600">
              {(100 - reportData.kpis.failRate).toFixed(1)}%
            </p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-1">Fail Rate</p>
            <p className="text-2xl font-bold text-red-600">
              {reportData.kpis.failRate.toFixed(1)}%
            </p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-1">Avg Runtime</p>
            <p className="text-2xl font-bold">{reportData.kpis.avgRuntimeMin}m</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-1">QC Flags</p>
            <p className="text-2xl font-bold text-yellow-600">{reportData.kpis.qcFlags}</p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Runs by Day */}
          <div className="bg-card rounded-lg border p-6">
            <h3 className="text-sm font-semibold mb-4">Daily Run Performance</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={reportData.series.runsByDay}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="passed"
                  stackId="1"
                  stroke={COLORS.passed}
                  fill={COLORS.passed}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="failed"
                  stackId="1"
                  stroke={COLORS.failed}
                  fill={COLORS.failed}
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Pass/Fail Distribution */}
          <div className="bg-card rounded-lg border p-6">
            <h3 className="text-sm font-semibold mb-4">Overall Status Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Passed', value: reportData.series.passFail.passed },
                    { name: 'Failed', value: reportData.series.passFail.failed }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill={COLORS.passed} />
                  <Cell fill={COLORS.failed} />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Failures by Instrument */}
          <div className="bg-card rounded-lg border p-6">
            <h3 className="text-sm font-semibold mb-4">Failures by Instrument</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={reportData.series.failuresByInstrument}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="instrument" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="failed" fill={COLORS.failed} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Runtime Trend */}
          <div className="bg-card rounded-lg border p-6">
            <h3 className="text-sm font-semibold mb-4">Average Runtime Trend</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={reportData.series.runtimeTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="minutes"
                  stroke={COLORS.primary}
                  strokeWidth={2}
                  dot={{ fill: COLORS.primary }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Runs Table */}
        <div className="bg-card rounded-lg border">
          <div className="p-6 border-b">
            <h3 className="text-sm font-semibold">Recent Run Details</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left p-4">Run ID</th>
                  <th className="text-left p-4">Instrument</th>
                  <th className="text-left p-4">Started</th>
                  <th className="text-left p-4">Duration</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">QC</th>
                </tr>
              </thead>
              <tbody>
                {reportData.table.slice(0, 10).map((run: any) => (
                  <tr key={run.runId} className="border-b hover:bg-muted/50 text-sm">
                    <td className="p-4 font-mono text-xs">{run.runId}</td>
                    <td className="p-4">{run.instrument}</td>
                    <td className="p-4">{format(new Date(run.startedAt), 'MMM dd, h:mm a')}</td>
                    <td className="p-4">{run.durationMin}m</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        {run.status === 'passed' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                        {run.status === 'failed' && <XCircle className="h-4 w-4 text-red-600" />}
                        {run.status === 'warning' && <AlertCircle className="h-4 w-4 text-yellow-600" />}
                        <span className="capitalize">{run.status}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {run.qc?.flag && (
                        <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                          {run.qc.flag}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}