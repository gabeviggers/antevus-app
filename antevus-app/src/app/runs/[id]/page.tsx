'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Beaker,
  TrendingUp,
  AlertCircle,
  Download,
  Share2,
  FileText
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// Mock data for the run - in production this would come from your API
const generateRunData = (runId: string) => {
  const isCancelled = runId.includes('CANCELLED');
  const isSuccess = !runId.includes('fail') && !isCancelled;
  const protocol = runId.includes('ELISA') ? 'ELISA' :
                   runId.includes('PCR') ? 'qPCR' :
                   runId.includes('HPLC') ? 'HPLC' : 'Standard Protocol';

  // Handle cancelled runs differently
  if (isCancelled) {
    return {
      id: runId,
      protocol,
      instrument: 'PR-07 (Plate Reader)',
      status: 'cancelled',
      startTime: new Date(Date.now() - 600000).toISOString(),
      endTime: new Date(Date.now() - 300000).toISOString(),
      duration: '5 minutes (cancelled)',
      operator: 'User',
      samples: 0,
      plateId: 'N/A',
      success: false,
      cancelled: true,
      cancellationReason: 'User requested cancellation',

      // Limited stage data for cancelled runs
      stages: [
        { name: 'Pre-check', status: 'completed', duration: '2 min', result: 'Passed' },
        { name: 'Sample Loading', status: 'cancelled', duration: '3 min', result: 'Cancelled' },
        { name: 'Primary Incubation', status: 'skipped', duration: '-', result: 'Skipped' },
        { name: 'Wash Cycle', status: 'skipped', duration: '-', result: 'Skipped' },
        { name: 'Secondary Incubation', status: 'skipped', duration: '-', result: 'Skipped' },
        { name: 'Detection', status: 'skipped', duration: '-', result: 'Skipped' },
        { name: 'Data Analysis', status: 'skipped', duration: '-', result: 'Skipped' }
      ],

      // No metrics for cancelled runs
      metrics: {
        avgOD: 'N/A',
        cv: 'N/A',
        signalToNoise: 'N/A',
        positiveControls: 'N/A',
        negativeControls: 'N/A',
        blankReading: 'N/A'
      },

      qcStatus: 'N/A',
      qcFlags: ['Run was cancelled before completion'],

      plateData: [],
      kinetics: [],
      distribution: [
        { name: 'Not Started', value: 96, color: '#9ca3af' }
      ]
    };
  }

  return {
    id: runId,
    protocol,
    instrument: 'PR-07 (Plate Reader)',
    status: isSuccess ? 'completed' : 'failed',
    startTime: new Date(Date.now() - 3600000).toISOString(),
    endTime: new Date().toISOString(),
    duration: '45 minutes',
    operator: 'System (Automated)',
    samples: 96,
    plateId: 'PLT-2024-0892',
    success: isSuccess,
    cancelled: false,

    // Stage execution data
    stages: [
      { name: 'Pre-check', status: 'completed', duration: '2 min', result: 'Passed' },
      { name: 'Sample Loading', status: 'completed', duration: '5 min', result: 'Passed' },
      { name: 'Primary Incubation', status: 'completed', duration: '15 min', result: 'Passed' },
      { name: 'Wash Cycle', status: 'completed', duration: '8 min', result: 'Passed' },
      { name: 'Secondary Incubation', status: 'completed', duration: '10 min', result: 'Passed' },
      { name: 'Detection', status: isSuccess ? 'completed' : 'failed', duration: '3 min', result: isSuccess ? 'Passed' : 'Failed' },
      { name: 'Data Analysis', status: isSuccess ? 'completed' : 'skipped', duration: '2 min', result: isSuccess ? 'Passed' : 'Skipped' }
    ],

    // Metrics
    metrics: {
      avgOD: isSuccess ? '1.245' : '0.432',
      cv: isSuccess ? '8.3%' : '24.7%',
      signalToNoise: isSuccess ? '12.5:1' : '3.2:1',
      positiveControls: isSuccess ? '8/8 Passed' : '5/8 Passed',
      negativeControls: isSuccess ? '8/8 Passed' : '6/8 Passed',
      blankReading: '0.089'
    },

    // Quality control
    qcStatus: isSuccess ? 'PASS' : 'FAIL',
    qcFlags: isSuccess ? [] : [
      'CV above acceptable threshold (>10%)',
      'Low signal-to-noise ratio (<5:1)',
      'Positive control failures detected'
    ],

    // Raw data for charts
    plateData: generatePlateData(isSuccess),
    kinetics: generateKineticsData(),
    distribution: generateDistributionData(isSuccess)
  };
};

// Generate mock plate data
function generatePlateData(success: boolean) {
  const data = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 12; col++) {
      const wellId = String.fromCharCode(65 + row) + (col + 1);
      const baseValue = success ? 1.2 : 0.4;
      const variation = Math.random() * 0.5;
      data.push({
        well: wellId,
        row: String.fromCharCode(65 + row),
        col: col + 1,
        od: baseValue + variation,
        status: Math.random() > (success ? 0.95 : 0.7) ? 'fail' : 'pass'
      });
    }
  }
  return data;
}

// Generate kinetics data
function generateKineticsData() {
  const data = [];
  for (let i = 0; i <= 30; i++) {
    data.push({
      time: i,
      od450: 0.1 + (i / 30) * 1.5 + Math.random() * 0.1,
      od620: 0.08 + (i / 30) * 0.3 + Math.random() * 0.05
    });
  }
  return data;
}

// Generate distribution data
function generateDistributionData(success: boolean) {
  return [
    { name: 'Passed', value: success ? 88 : 45, color: '#10b981' },
    { name: 'Failed', value: success ? 5 : 35, color: '#ef4444' },
    { name: 'Borderline', value: success ? 3 : 16, color: '#f59e0b' }
  ];
}

export default function RunResultPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.id as string;
  const [runData, setRunData] = useState<ReturnType<typeof generateRunData> | null>(null);

  useEffect(() => {
    // Simulate fetching run data
    const data = generateRunData(runId);
    setRunData(data);
  }, [runId]);

  if (!runData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  {runData.protocol} Run Results
                  {runData.cancelled ? (
                    <XCircle className="h-6 w-6 text-gray-500" />
                  ) : runData.success ? (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-500" />
                  )}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Run ID: {runData.id} • {new Date(runData.startTime).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-accent rounded-lg transition-colors">
                <Share2 className="h-5 w-5" />
              </button>
              <button className="p-2 hover:bg-accent rounded-lg transition-colors">
                <Download className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Run Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card p-4 rounded-lg border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Activity className="h-4 w-4" />
              <span className="text-xs font-medium">STATUS</span>
            </div>
            <p className={`text-2xl font-bold ${
              runData.cancelled ? 'text-gray-500' :
              runData.success ? 'text-green-500' : 'text-red-500'
            }`}>
              {runData.status.toUpperCase()}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              QC: {runData.qcStatus}
            </p>
          </div>

          <div className="bg-card p-4 rounded-lg border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">DURATION</span>
            </div>
            <p className="text-2xl font-bold">{runData.duration}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {runData.samples} samples
            </p>
          </div>

          <div className="bg-card p-4 rounded-lg border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Beaker className="h-4 w-4" />
              <span className="text-xs font-medium">INSTRUMENT</span>
            </div>
            <p className="text-lg font-bold">{runData.instrument}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Plate: {runData.plateId}
            </p>
          </div>

          <div className="bg-card p-4 rounded-lg border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">AVG OD</span>
            </div>
            <p className="text-2xl font-bold">{runData.metrics.avgOD}</p>
            <p className="text-sm text-muted-foreground mt-1">
              CV: {runData.metrics.cv}
            </p>
          </div>
        </div>

        {/* Cancellation Info */}
        {runData.cancelled && (
          <div className="bg-gray-50 dark:bg-gray-950/20 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-gray-500 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-gray-400 mb-2">
                  Run Cancelled
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {runData.cancellationReason}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  The protocol was stopped at the user's request. No data was collected after cancellation.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* QC Flags */}
        {!runData.cancelled && runData.qcFlags.length > 0 && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 dark:text-red-400 mb-2">
                  Quality Control Issues
                </h3>
                <ul className="space-y-1">
                  {runData.qcFlags.map((flag, idx) => (
                    <li key={idx} className="text-sm text-red-800 dark:text-red-300">
                      • {flag}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Stage Execution Timeline */}
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Protocol Execution Timeline</h2>
          <div className="space-y-3">
            {runData.stages.map((stage, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                  stage.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' :
                  stage.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30' :
                  'bg-gray-100 dark:bg-gray-800'
                }`}>
                  {stage.status === 'completed' ? (
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : stage.status === 'failed' ? (
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  ) : (
                    <div className="h-2 w-2 bg-gray-400 rounded-full" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{stage.name}</p>
                      <p className="text-sm text-muted-foreground">{stage.duration}</p>
                    </div>
                    <span className={`text-sm font-medium ${
                      stage.result === 'Passed' ? 'text-green-600 dark:text-green-400' :
                      stage.result === 'Failed' ? 'text-red-600 dark:text-red-400' :
                      'text-gray-500'
                    }`}>
                      {stage.result}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Kinetics Chart */}
          <div className="bg-card rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-4">Reaction Kinetics</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={runData.kinetics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" label={{ value: 'Time (min)', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'OD', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="od450" stroke="#3b82f6" name="OD 450nm" strokeWidth={2} />
                <Line type="monotone" dataKey="od620" stroke="#8b5cf6" name="OD 620nm" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Distribution Pie Chart */}
          <div className="bg-card rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-4">Sample Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={runData.distribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {runData.distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="bg-card rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Key Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Avg OD</p>
              <p className="text-xl font-bold">{runData.metrics.avgOD}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">CV</p>
              <p className="text-xl font-bold">{runData.metrics.cv}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">S/N Ratio</p>
              <p className="text-xl font-bold">{runData.metrics.signalToNoise}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Positive Controls</p>
              <p className="text-xl font-bold">{runData.metrics.positiveControls}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Negative Controls</p>
              <p className="text-xl font-bold">{runData.metrics.negativeControls}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Blank</p>
              <p className="text-xl font-bold">{runData.metrics.blankReading}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
              Download Full Report
            </button>
            <button className="px-4 py-2 border rounded-lg hover:bg-accent transition-colors">
              Export Data (CSV)
            </button>
            <button className="px-4 py-2 border rounded-lg hover:bg-accent transition-colors">
              View Raw Data
            </button>
          </div>
          <button className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <FileText className="h-4 w-4" />
            Generate Compliance Report
          </button>
        </div>
      </div>
    </div>
  );
}