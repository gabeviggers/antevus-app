export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'syncing'
export type IntegrationCategory = 'eln_lims' | 'communication' | 'data_analysis' | 'storage' | 'automation'

export interface IntegrationConfig {
  apiKey?: string
  webhookUrl?: string
  channel?: string
  workspace?: string
  projectId?: string
  folder?: string
  syncInterval?: number
  enableNotifications?: boolean
  autoSync?: boolean
}

export interface Integration {
  id: string
  name: string
  description: string
  category: IntegrationCategory
  icon: string // We'll use emoji or icon names
  status: IntegrationStatus
  connectedAt?: string
  lastSync?: string
  config?: IntegrationConfig
  features: string[]
  setupTime: string // e.g., "2 minutes"
  isPopular?: boolean
  isPremium?: boolean
  documentation?: string
}

export const INTEGRATION_CATEGORIES: Record<IntegrationCategory, { label: string; description: string }> = {
  eln_lims: {
    label: 'ELN & LIMS',
    description: 'Electronic Lab Notebooks and Laboratory Information Management Systems'
  },
  communication: {
    label: 'Communication',
    description: 'Team collaboration and notification tools'
  },
  data_analysis: {
    label: 'Data Analysis',
    description: 'Analysis, visualization, and reporting tools'
  },
  storage: {
    label: 'Cloud Storage',
    description: 'File storage and data backup solutions'
  },
  automation: {
    label: 'Automation',
    description: 'Workflow automation and orchestration tools'
  }
}

export const mockIntegrations: Integration[] = [
  // ELN & LIMS
  {
    id: 'benchling',
    name: 'Benchling',
    description: 'Modern cloud-based platform for life science R&D',
    category: 'eln_lims',
    icon: '🧬',
    status: 'connected',
    connectedAt: '2024-11-15T10:30:00Z',
    lastSync: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
    config: {
      // Credentials stored securely server-side, never exposed to client
      projectId: 'proj_ABC123',
      syncInterval: 300,
      autoSync: true
    },
    features: [
      'Automatic run data sync',
      'Sample tracking',
      'Protocol integration',
      'Result upload'
    ],
    setupTime: '5 minutes',
    isPopular: true,
    documentation: 'https://docs.benchling.com/api'
  },
  {
    id: 'labarchives',
    name: 'LabArchives',
    description: 'Professional-grade electronic lab notebook',
    category: 'eln_lims',
    icon: '📔',
    status: 'disconnected',
    features: [
      'Compliance-ready documentation',
      'Version control',
      'Witness & sign workflows',
      'Audit trails'
    ],
    setupTime: '10 minutes',
    documentation: 'https://labarchives.com/api-docs'
  },
  {
    id: 'labguru',
    name: 'Labguru',
    description: 'All-in-one ELN, LIMS & Inventory Management',
    category: 'eln_lims',
    icon: '⚗️',
    status: 'disconnected',
    features: [
      'Inventory management',
      'Equipment scheduling',
      'Sample management',
      'Compliance tracking'
    ],
    setupTime: '15 minutes',
    documentation: 'https://labguru.com/api'
  },

  // Communication
  {
    id: 'slack',
    name: 'Slack',
    description: 'Real-time messaging and notifications',
    category: 'communication',
    icon: '💬',
    status: 'connected',
    connectedAt: '2024-10-20T14:00:00Z',
    lastSync: new Date().toISOString(),
    config: {
      // Webhook URL stored securely server-side
      channel: '#lab-instruments',
      enableNotifications: true
    },
    features: [
      'Run completion alerts',
      'Error notifications',
      'Daily summaries',
      'Custom webhooks'
    ],
    setupTime: '2 minutes',
    isPopular: true,
    documentation: 'https://api.slack.com'
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Collaborate with your research team',
    category: 'communication',
    icon: '👥',
    status: 'error',
    connectedAt: '2024-11-01T09:00:00Z',
    features: [
      'Channel notifications',
      'Direct messages',
      'File sharing',
      'Video calls integration'
    ],
    setupTime: '5 minutes',
    isPopular: true,
    documentation: 'https://docs.microsoft.com/en-us/graph'
  },
  {
    id: 'email',
    name: 'Email Notifications',
    description: 'Custom email alerts and reports',
    category: 'communication',
    icon: '📧',
    status: 'connected',
    connectedAt: '2024-09-01T00:00:00Z',
    config: {
      enableNotifications: true
    },
    features: [
      'Custom alert rules',
      'Daily/weekly reports',
      'Multiple recipients',
      'HTML templates'
    ],
    setupTime: '1 minute',
    documentation: '#'
  },

  // Data Analysis
  {
    id: 'jupyter',
    name: 'Jupyter',
    description: 'Interactive computing and data analysis',
    category: 'data_analysis',
    icon: '📊',
    status: 'disconnected',
    features: [
      'Direct data access',
      'Custom analysis pipelines',
      'Visualization tools',
      'Python/R support'
    ],
    setupTime: '10 minutes',
    documentation: 'https://jupyter.org/documentation'
  },
  {
    id: 'graphpad',
    name: 'GraphPad Prism',
    description: 'Scientific graphing and statistics',
    category: 'data_analysis',
    icon: '📈',
    status: 'disconnected',
    features: [
      'Statistical analysis',
      'Publication-ready graphs',
      'Curve fitting',
      'Data tables'
    ],
    setupTime: '5 minutes',
    isPremium: true,
    documentation: 'https://graphpad.com/api'
  },
  {
    id: 'tableau',
    name: 'Tableau',
    description: 'Advanced data visualization platform',
    category: 'data_analysis',
    icon: '📉',
    status: 'syncing',
    connectedAt: '2024-11-10T16:00:00Z',
    features: [
      'Interactive dashboards',
      'Real-time data sync',
      'Custom visualizations',
      'Sharing & collaboration'
    ],
    setupTime: '20 minutes',
    isPremium: true,
    documentation: 'https://tableau.com/developer'
  },

  // Cloud Storage
  {
    id: 'aws-s3',
    name: 'AWS S3',
    description: 'Scalable cloud storage for raw data',
    category: 'storage',
    icon: '☁️',
    status: 'connected',
    connectedAt: '2024-08-15T00:00:00Z',
    lastSync: new Date().toISOString(),
    config: {
      folder: 'antevus-lab-data/',
      autoSync: true
    },
    features: [
      'Automatic backup',
      'Versioning',
      'Lifecycle policies',
      'Encryption at rest'
    ],
    setupTime: '15 minutes',
    documentation: 'https://aws.amazon.com/s3'
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Easy file sharing and collaboration',
    category: 'storage',
    icon: '📁',
    status: 'disconnected',
    features: [
      'Automatic sync',
      'Team folders',
      'Version history',
      'Comments & sharing'
    ],
    setupTime: '3 minutes',
    isPopular: true,
    documentation: 'https://developers.google.com/drive'
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'Simple and secure file sync',
    category: 'storage',
    icon: '📦',
    status: 'disconnected',
    features: [
      'File sync',
      'Team folders',
      'File requests',
      'Smart sync'
    ],
    setupTime: '3 minutes',
    documentation: 'https://dropbox.com/developers'
  },

  // Automation
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Connect to 5000+ apps without code',
    category: 'automation',
    icon: '⚡',
    status: 'disconnected',
    features: [
      'Multi-step workflows',
      'Conditional logic',
      'Data transformation',
      'Schedule triggers'
    ],
    setupTime: '10 minutes',
    isPopular: true,
    documentation: 'https://zapier.com/developer'
  },
  {
    id: 'n8n',
    name: 'n8n',
    description: 'Open-source workflow automation',
    category: 'automation',
    icon: '🔄',
    status: 'disconnected',
    features: [
      'Self-hosted option',
      'Visual workflow builder',
      'Custom functions',
      'API endpoints'
    ],
    setupTime: '20 minutes',
    documentation: 'https://docs.n8n.io'
  },
  {
    id: 'github-actions',
    name: 'GitHub Actions',
    description: 'Automate your development workflows',
    category: 'automation',
    icon: '🐙',
    status: 'disconnected',
    features: [
      'CI/CD pipelines',
      'Custom actions',
      'Matrix builds',
      'Secrets management'
    ],
    setupTime: '15 minutes',
    documentation: 'https://docs.github.com/actions'
  }
]

// Helper functions
export function getIntegrationsByCategory(category: IntegrationCategory): Integration[] {
  return mockIntegrations.filter(i => i.category === category)
}

export function getConnectedIntegrations(): Integration[] {
  return mockIntegrations.filter(i => i.status === 'connected')
}

export function getPopularIntegrations(): Integration[] {
  return mockIntegrations.filter(i => i.isPopular)
}

export function updateIntegrationStatus(
  integrationId: string,
  status: IntegrationStatus,
  config?: IntegrationConfig
): Integration | undefined {
  const integration = mockIntegrations.find(i => i.id === integrationId)
  if (integration) {
    integration.status = status
    if (status === 'connected') {
      integration.connectedAt = new Date().toISOString()
      integration.lastSync = new Date().toISOString()
      if (config) {
        integration.config = config
      }
    } else if (status === 'disconnected') {
      integration.connectedAt = undefined
      integration.lastSync = undefined
      integration.config = undefined
    }
  }
  return integration
}