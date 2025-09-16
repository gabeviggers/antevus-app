'use client'

import React, { useState } from 'react'
import {
  Search,
  Copy,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ChevronRight,
  BarChart3,
  Key,
  FileText,
  HardDrive,
  Activity,
  Settings,
  Users,
  FlaskConical,
  Sliders,
  ArrowLeft
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { useRouter } from 'next/navigation'

// Type definitions
interface NavItem {
  title: string
  href?: string
  icon?: React.ReactNode
  items?: NavItem[]
}

// Sidebar content for different tabs (matching OpenAI's structure)
const SIDEBAR_CONTENT: Record<string, NavItem[]> = {
  // Dashboard sidebar (like OpenAI's left sidebar in Dashboard view)
  dashboard: [
    {
      title: 'Create',
      items: [
        { title: 'Run Experiment', icon: <Activity className="h-4 w-4" />, href: 'run' },
        { title: 'Batch Processing', icon: <FlaskConical className="h-4 w-4" />, href: 'batch' },
        { title: 'Data Import', icon: <FileText className="h-4 w-4" />, href: 'import' },
        { title: 'Templates', icon: <FileText className="h-4 w-4" />, href: 'templates' }
      ]
    },
    {
      title: 'Manage',
      items: [
        { title: 'Usage', icon: <BarChart3 className="h-4 w-4" />, href: 'usage' },
        { title: 'API keys', icon: <Key className="h-4 w-4" />, href: 'api-keys' },
        { title: 'Logs', icon: <FileText className="h-4 w-4" />, href: 'logs' },
        { title: 'Storage', icon: <HardDrive className="h-4 w-4" />, href: 'storage' },
        { title: 'Batches', icon: <FileText className="h-4 w-4" />, href: 'batches' }
      ]
    },
    {
      title: 'Optimize',
      items: [
        { title: 'Evaluations', icon: <FlaskConical className="h-4 w-4" />, href: 'evaluations' },
        { title: 'Fine-tuning', icon: <Sliders className="h-4 w-4" />, href: 'fine-tuning' }
      ]
    }
  ],

  // Docs sidebar (like OpenAI's documentation structure)
  docs: [
    {
      title: 'Get started',
      items: [
        { title: 'Overview', href: 'overview' },
        { title: 'Quickstart', href: 'quickstart' },
        { title: 'Models', href: 'models' },
        { title: 'Pricing', href: 'pricing' },
        { title: 'Libraries', href: 'libraries' }
      ]
    },
    {
      title: 'Core concepts',
      items: [
        { title: 'Data normalization', href: 'data-normalization' },
        { title: 'Instrument discovery', href: 'instrument-discovery' },
        { title: 'Real-time monitoring', href: 'monitoring' },
        { title: 'Compliance & logging', href: 'compliance' },
        { title: 'Error handling', href: 'error-handling' }
      ]
    },
    {
      title: 'Tools',
      items: [
        { title: 'Using tools', href: 'using-tools' },
        { title: 'Connectors and MCP', href: 'connectors' }
      ]
    }
  ],

  // API Reference sidebar (matching OpenAI's API reference)
  reference: [
    {
      title: 'API Reference',
      items: [
        { title: 'Introduction', href: 'intro' },
        { title: 'Authentication', href: 'auth' },
        { title: 'Rate limiting', href: 'rate-limits' },
        { title: 'Error codes', href: 'errors' }
      ]
    },
    {
      title: 'Instruments API',
      items: [
        { title: 'List instruments', href: 'list-instruments' },
        { title: 'Get instrument', href: 'get-instrument' },
        { title: 'Start run', href: 'start-run' },
        { title: 'Stop run', href: 'stop-run' }
      ]
    },
    {
      title: 'Runs API',
      items: [
        { title: 'List runs', href: 'list-runs' },
        { title: 'Get run', href: 'get-run' },
        { title: 'Export data', href: 'export-data' }
      ]
    },
    {
      title: 'Webhooks',
      items: [
        { title: 'Webhook Events', href: 'webhook-events' }
      ]
    },
    {
      title: 'Platform APIs',
      items: [
        { title: 'Monitoring', href: 'monitoring-api' },
        { title: 'Data Export', href: 'export-api' },
        { title: 'Integrations', href: 'integrations' }
      ]
    }
  ]
}

export default function APIPlayground() {
  const { toast } = useToast()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'docs' | 'reference'>('dashboard')
  const [selectedItem, setSelectedItem] = useState('api-keys')
  const [searchQuery, setSearchQuery] = useState('')

  // API Key Management State
  const [apiKeys, setApiKeys] = useState([
    {
      id: '1',
      name: 'Production Key',
      key: 'av_live_...k3j4',
      created: 'Dec 10, 2024',
      lastUsed: 'Dec 15, 2024',
      permissions: 'All'
    },
    {
      id: '2',
      name: 'Test Key',
      key: 'av_test_...m9n2',
      created: 'Dec 12, 2024',
      lastUsed: 'Never',
      permissions: 'Read only'
    }
  ])
  const [showKey, setShowKey] = useState<string | null>(null)
  const [newKeyName, setNewKeyName] = useState('')
  const [isCreatingKey, setIsCreatingKey] = useState(false)

  const handleCreateKey = () => {
    if (!newKeyName) return

    const newKey = {
      id: Date.now().toString(),
      name: newKeyName,
      key: `av_test_${Math.random().toString(36).substring(2, 15)}`,
      created: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      lastUsed: 'Never',
      permissions: 'All'
    }

    setApiKeys([...apiKeys, newKey])
    setNewKeyName('')
    setIsCreatingKey(false)
    toast({
      title: 'API key created',
      description: 'Your new API key has been generated.',
    })
  }

  const handleDeleteKey = (id: string) => {
    setApiKeys(apiKeys.filter(key => key.id !== id))
    toast({
      title: 'API key deleted',
      description: 'The API key has been permanently removed.',
    })
  }

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copied',
      description: 'Copied to clipboard.',
    })
  }

  const renderContent = () => {
    // API Keys page (Dashboard > API keys)
    if (activeTab === 'dashboard' && selectedItem === 'api-keys') {
      return (
        <div className="p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold">API Keys</h1>
            <p className="text-muted-foreground mt-1">
              You have permission to view and manage all API keys in this project.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Do not share your API key with others or expose it in the browser or other client-side code.
            </p>
          </div>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm text-muted-foreground">
                  View usage per API key on the <a href="#" className="underline">Usage page</a>.
                </p>
              </div>
              <Button onClick={() => setIsCreatingKey(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create new secret key
              </Button>
            </div>

            {isCreatingKey && (
              <div className="mb-6 p-4 border rounded-lg bg-muted/20">
                <Label htmlFor="keyName">Name (Optional)</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="keyName"
                    placeholder="My Test Key"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="max-w-sm"
                  />
                  <Button onClick={handleCreateKey}>Create secret key</Button>
                  <Button variant="outline" onClick={() => {
                    setIsCreatingKey(false)
                    setNewKeyName('')
                  }}>Cancel</Button>
                </div>
              </div>
            )}

            <div className="border rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">NAME</th>
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">SECRET KEY</th>
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">CREATED</th>
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">LAST USED</th>
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">CREATED BY</th>
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">PERMISSIONS</th>
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((apiKey) => (
                    <tr key={apiKey.id} className="border-b hover:bg-muted/10">
                      <td className="p-4">{apiKey.name}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <code className="text-sm">
                            {showKey === apiKey.id ? apiKey.key : `${apiKey.key.substring(0, 7)}...${apiKey.key.slice(-4)}`}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowKey(showKey === apiKey.id ? null : apiKey.id)}
                          >
                            {showKey === apiKey.id ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyCode(apiKey.key)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                      <td className="p-4 text-sm">{apiKey.created}</td>
                      <td className="p-4 text-sm">{apiKey.lastUsed}</td>
                      <td className="p-4 text-sm">You</td>
                      <td className="p-4 text-sm">{apiKey.permissions}</td>
                      <td className="p-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteKey(apiKey.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )
    }

    // Usage page
    if (activeTab === 'dashboard' && selectedItem === 'usage') {
      return (
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">Usage</h1>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Default project</Button>
              <Button variant="outline" size="sm">December 2024</Button>
              <Button variant="outline" size="sm">Export</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <Card className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Spend</p>
                  <p className="text-3xl font-bold">$247.50</p>
                  <p className="text-sm text-muted-foreground mt-1">$1,250.00 limit</p>
                </div>
                <Button variant="outline" size="sm">1m</Button>
              </div>
              <div className="h-32 bg-muted/20 rounded flex items-center justify-center text-muted-foreground">
                [Usage Chart]
              </div>
            </Card>

            <Card className="p-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2">December budget</p>
                <p className="text-2xl font-bold">$247.50 / $1,500</p>
                <div className="w-full bg-muted rounded-full h-2 mt-4">
                  <div className="bg-primary h-2 rounded-full" style={{ width: '16.5%' }}></div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Resets in 15 days. <a href="#" className="underline">Edit budget</a></p>
              </div>
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm text-muted-foreground">Total tokens</p>
                <p className="text-2xl font-bold">1.2M</p>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4">
              <h3 className="font-medium mb-3">API Capabilities</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Instruments API</span>
                  <span>5,234 requests</span>
                </div>
                <div className="flex justify-between">
                  <span>Runs API</span>
                  <span>3,421 requests</span>
                </div>
                <div className="flex justify-between">
                  <span>Monitoring API</span>
                  <span>2,888 requests</span>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-medium mb-3">Spend categories</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Data Processing</span>
                  <span>$142.30</span>
                </div>
                <div className="flex justify-between">
                  <span>Storage</span>
                  <span>$65.20</span>
                </div>
                <div className="flex justify-between">
                  <span>API Calls</span>
                  <span>$40.00</span>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-medium mb-3">Users</h3>
              <p className="text-sm text-muted-foreground">
                There is no usage data for this period and group.
              </p>
            </Card>
          </div>
        </div>
      )
    }

    // Default content
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold mb-4">Welcome to Antevus Platform</h1>
        <p className="text-muted-foreground">
          Select an item from the sidebar to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Top Navigation Bar - Like OpenAI's Dashboard/Docs/API Reference tabs */}
      <div className="h-16 flex items-center justify-between px-4 border-b">
        <div className="flex items-center gap-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">API Playground</h1>
          {/* Main Navigation Tabs */}
          <div className="flex gap-1">
              <button
                onClick={() => {
                  setActiveTab('dashboard')
                  setSelectedItem('api-keys')
                }}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                  activeTab === 'dashboard'
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                )}
              >
                Dashboard
              </button>
              <button
                onClick={() => {
                  setActiveTab('docs')
                  setSelectedItem('overview')
                }}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                  activeTab === 'docs'
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                )}
              >
                Docs
              </button>
              <button
                onClick={() => {
                  setActiveTab('reference')
                  setSelectedItem('intro')
                }}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                  activeTab === 'reference'
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                )}
              >
                API reference
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Users className="h-4 w-4" />
            </Button>
            <ThemeToggle />
        </div>
      </div>

      {/* Content area with sidebar and main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Changes content based on active tab */}
        <div className="w-60 border-r bg-muted/5 overflow-y-auto">
          {/* Search */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
              <div className="absolute right-2.5 top-2.5 flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">⌘</kbd>
                <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">K</kbd>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-3">
            {SIDEBAR_CONTENT[activeTab]?.map((section, idx) => (
              <div key={idx} className="mb-6">
                {section.title && (
                  <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {section.title}
                  </h3>
                )}
                <div className="space-y-0.5">
                  {section.items?.map((item) => (
                    <button
                      key={item.href}
                      onClick={() => setSelectedItem(item.href || '')}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors",
                        selectedItem === item.href
                          ? "bg-accent text-accent-foreground font-medium"
                          : "hover:bg-accent/50 text-muted-foreground"
                      )}
                    >
                      {item.icon && <span>{item.icon}</span>}
                      <span>{item.title}</span>
                      {item.items && <ChevronRight className="h-3 w-3 ml-auto" />}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Footer links */}
            <div className="mt-6 pt-6 border-t">
              <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground">
                <FileText className="h-4 w-4" />
                Cookbook
              </button>
              <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground">
                <Users className="h-4 w-4" />
                Forum
              </button>
            </div>
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}