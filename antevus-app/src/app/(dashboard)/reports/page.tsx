'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Calendar, Download, Mail, FileText, TrendingUp, Clock, Filter } from 'lucide-react';
import { format } from 'date-fns';

interface Report {
  id: string;
  title: string;
  type: string;
  createdAt: string;
  dateRange: {
    start: string;
    end: string;
  };
  status: 'completed' | 'generating' | 'failed';
  size: string;
  requestedBy: string;
  instruments: string[];
}

// Demo data - would come from API
const generateDemoReports = (): Report[] => {
  const reports: Report[] = [];
  const types = ['Performance Report', 'QC Analysis', 'Run Summary', 'Failure Analysis', 'Utilization Report'];
  const statuses: Report['status'][] = ['completed', 'completed', 'completed', 'generating'];

  for (let i = 0; i < 12; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i * 3);

    reports.push({
      id: `rpt-${Date.now()}-${i}`,
      title: `${types[i % types.length]} - Week ${Math.floor(i / 7) + 1}`,
      type: types[i % types.length],
      createdAt: date.toISOString(),
      dateRange: {
        start: new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end: date.toISOString()
      },
      status: statuses[Math.min(i, statuses.length - 1)],
      size: `${(Math.random() * 5 + 0.5).toFixed(1)} MB`,
      requestedBy: 'Lab Assistant',
      instruments: ['HPLC-001', 'MS-002', 'PCR-003'].slice(0, (i % 3) + 1)
    });
  }

  return reports;
};

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching reports
    setTimeout(() => {
      const data = generateDemoReports();
      setReports(data);
      setFilteredReports(data);
      setIsLoading(false);
    }, 500);
  }, []);

  useEffect(() => {
    let filtered = [...reports];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(report =>
        report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.instruments.some(i => i.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(report => report.type === filterType);
    }

    setFilteredReports(filtered);
  }, [searchQuery, filterType, reports]);

  const getStatusColor = (status: Report['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'generating': return 'text-yellow-600 bg-yellow-50';
      case 'failed': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: Report['status']) => {
    switch (status) {
      case 'completed': return <FileText className="h-4 w-4" />;
      case 'generating': return <Clock className="h-4 w-4 animate-spin" />;
      case 'failed': return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Reports</h1>
            <p className="text-sm text-muted-foreground mt-1">
              View and manage all generated reports
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Generate Report
            </button>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="px-6 py-4 border-b bg-background/95">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            >
              <option value="all">All Types</option>
              <option value="Performance Report">Performance Report</option>
              <option value="QC Analysis">QC Analysis</option>
              <option value="Run Summary">Run Summary</option>
              <option value="Failure Analysis">Failure Analysis</option>
              <option value="Utilization Report">Utilization Report</option>
            </select>
          </div>

          {/* Date Range */}
          <button className="px-4 py-2 bg-background border border-border rounded-lg text-sm hover:bg-accent transition-colors flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Last 30 days
          </button>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-background to-muted/20">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-3">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">Loading reports...</p>
            </div>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-3">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
              <h3 className="text-lg font-medium">No reports found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'Try adjusting your search criteria' : 'Generate your first report from the Lab Assistant'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                onClick={() => router.push(`/reports/${report.id}`)}
                className="bg-card border border-border rounded-lg p-5 hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer group"
              >
                {/* Report Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${getStatusColor(report.status).replace('text-', 'bg-').replace('600', '100')}`}>
                      {getStatusIcon(report.status)}
                    </div>
                    <div>
                      <h3 className="font-medium text-sm group-hover:text-primary transition-colors">
                        {report.title}
                      </h3>
                      <p className="text-xs text-muted-foreground">{report.type}</p>
                    </div>
                  </div>
                </div>

                {/* Report Details */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Date Range</span>
                    <span className="font-medium">
                      {format(new Date(report.dateRange.start), 'MMM dd')} - {format(new Date(report.dateRange.end), 'MMM dd')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Instruments</span>
                    <span className="font-medium">{report.instruments.length} devices</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-medium">
                      {format(new Date(report.createdAt), 'MMM dd, h:mm a')}
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="mt-4 pt-3 border-t flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(report.status)}`}>
                    {report.status === 'generating' ? 'Generating...' : report.status}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Handle email
                      }}
                      className="p-1.5 hover:bg-accent rounded-lg transition-colors"
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Handle download
                      }}
                      className="p-1.5 hover:bg-accent rounded-lg transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}