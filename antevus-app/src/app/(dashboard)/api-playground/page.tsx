'use client'

import React, { useState } from 'react'
import { Search, Key, Copy, Check, Shield, Activity, Lock, AlertCircle, ExternalLink, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { ThemeToggle } from '@/components/theme-toggle'

// API Endpoints data structure
const API_ENDPOINTS = {
  instruments: {
    title: 'Instruments',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/instruments',
        description: 'List all connected instruments',
        params: {
          query: [
            { name: 'status', type: 'string', required: false, description: 'Filter by status (running, idle, error)' },
            { name: 'type', type: 'string', required: false, description: 'Filter by instrument type' },
            { name: 'limit', type: 'integer', required: false, description: 'Max number of results (default: 50)' },
            { name: 'offset', type: 'integer', required: false, description: 'Pagination offset' }
          ]
        },
        response: {
          success: {
            code: 200,
            body: {
              instruments: [
                {
                  id: 'inst_123',
                  name: 'Illumina NovaSeq 6000',
                  type: 'sequencer',
                  status: 'running',
                  location: 'Lab A - Bay 3',
                  lastSeen: '2024-12-15T10:30:00Z'
                }
              ],
              total: 8,
              offset: 0,
              limit: 50
            }
          }
        }
      },
      {
        method: 'GET',
        path: '/api/v1/instruments/{id}',
        description: 'Get detailed information about a specific instrument',
        params: {
          path: [
            { name: 'id', type: 'string', required: true, description: 'Instrument ID' }
          ]
        },
        response: {
          success: {
            code: 200,
            body: {
              id: 'inst_123',
              name: 'Illumina NovaSeq 6000',
              type: 'sequencer',
              status: 'running',
              metadata: {
                model: 'NovaSeq 6000',
                serialNumber: 'NS6-2024-001',
                firmware: 'v3.2.1'
              }
            }
          }
        }
      },
      {
        method: 'POST',
        path: '/api/v1/instruments/{id}/control',
        description: 'Send control commands to an instrument',
        params: {
          path: [
            { name: 'id', type: 'string', required: true, description: 'Instrument ID' }
          ],
          body: {
            command: 'start|stop|pause|resume',
            parameters: {}
          }
        },
        response: {
          success: {
            code: 202,
            body: {
              message: 'Command accepted',
              commandId: 'cmd_456',
              status: 'pending'
            }
          }
        }
      }
    ]
  },
  runs: {
    title: 'Runs',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/runs',
        description: 'List all runs across instruments',
        params: {
          query: [
            { name: 'instrument_id', type: 'string', required: false, description: 'Filter by instrument' },
            { name: 'status', type: 'string', required: false, description: 'Filter by status' },
            { name: 'from_date', type: 'datetime', required: false, description: 'Start date (ISO 8601)' },
            { name: 'to_date', type: 'datetime', required: false, description: 'End date (ISO 8601)' }
          ]
        }
      },
      {
        method: 'GET',
        path: '/api/v1/runs/{id}/data',
        description: 'Download run data in various formats',
        params: {
          path: [
            { name: 'id', type: 'string', required: true, description: 'Run ID' }
          ],
          query: [
            { name: 'format', type: 'string', required: false, description: 'Output format (json, csv, parquet)' }
          ]
        }
      }
    ]
  },
  webhooks: {
    title: 'Webhooks',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/webhooks',
        description: 'Subscribe to real-time events',
        params: {
          body: {
            url: 'https://your-app.com/webhook',
            events: ['run.started', 'run.completed', 'instrument.error'],
            secret: 'webhook_secret_key'
          }
        }
      },
      {
        method: 'DELETE',
        path: '/api/v1/webhooks/{id}',
        description: 'Unsubscribe from webhook',
        params: {
          path: [
            { name: 'id', type: 'string', required: true, description: 'Webhook ID' }
          ]
        }
      }
    ]
  },
  monitoring: {
    title: 'Monitoring',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/monitoring/metrics',
        description: 'Get real-time metrics stream',
        params: {
          query: [
            { name: 'instrument_id', type: 'string', required: true, description: 'Instrument to monitor' },
            { name: 'metrics', type: 'array', required: false, description: 'Specific metrics to retrieve' }
          ]
        }
      },
      {
        method: 'GET',
        path: '/api/v1/monitoring/alerts',
        description: 'Get active alerts and warnings',
        params: {
          query: [
            { name: 'severity', type: 'string', required: false, description: 'Filter by severity (critical, warning, info)' }
          ]
        }
      }
    ]
  }
}

// Code examples generator
const generateCodeExample = (endpoint: { method: string; path: string; params?: { body?: unknown; query?: unknown; path?: unknown } }, language: string, apiKey: string) => {
  const baseUrl = 'https://api.antevus.com'
  const fullPath = `${baseUrl}${endpoint.path}`

  switch (language) {
    case 'python':
      return `import requests

headers = {
    'Authorization': f'Bearer ${apiKey}',
    'Content-Type': 'application/json'
}

response = requests.${endpoint.method.toLowerCase()}(
    '${fullPath}',
    headers=headers${endpoint.params?.body ? `,
    json=${JSON.stringify(endpoint.params.body, null, 4).split('\n').join('\n    ')}` : ''}
)

print(response.json())`

    case 'javascript':
      return `const response = await fetch('${fullPath}', {
  method: '${endpoint.method}',
  headers: {
    'Authorization': 'Bearer ${apiKey}',
    'Content-Type': 'application/json'
  }${endpoint.params?.body ? `,
  body: JSON.stringify(${JSON.stringify(endpoint.params.body, null, 2).split('\n').join('\n  ')})` : ''}
});

const data = await response.json();
console.log(data);`

    case 'curl':
      return `curl -X ${endpoint.method} '${fullPath}' \\
  -H 'Authorization: Bearer ${apiKey}' \\
  -H 'Content-Type: application/json'${endpoint.params?.body ? ` \\
  -d '${JSON.stringify(endpoint.params.body)}'` : ''}`

    default:
      return ''
  }
}

export default function APIPlaygroundPage() {
  const [selectedCategory, setSelectedCategory] = useState('instruments')
  const [selectedEndpoint, setSelectedEndpoint] = useState(0)
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('python')
  const [copiedCode, setCopiedCode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [testMode, setTestMode] = useState(true)
  const [isGeneratingKey, setIsGeneratingKey] = useState(false)

  // Generate a new API key (mock for now, will be server-side)
  const generateApiKey = async () => {
    setIsGeneratingKey(true)
    try {
      // In production, this would be a secure server-side operation
      const response = await fetch('/api/auth/generate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'csrf_token_here' // CSRF protection
        },
        body: JSON.stringify({
          name: 'Development Key',
          permissions: ['read', 'write'],
          expiresIn: '30d'
        })
      })

      if (response.ok) {
        const data = await response.json()
        setApiKey(data.key)
        toast({
          title: 'API Key Generated',
          description: 'Your new API key has been created securely.',
        })
      }
    } catch {
      // For demo, generate a mock key
      const mockKey = 'ak_live_' + Array.from({ length: 32 }, () =>
        '0123456789abcdef'[Math.floor(Math.random() * 16)]
      ).join('')
      setApiKey(mockKey)
      toast({
        title: 'Demo API Key Generated',
        description: 'This is a demo key for testing purposes.',
      })
    } finally {
      setIsGeneratingKey(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
    toast({
      title: 'Copied!',
      description: 'Code example copied to clipboard.',
    })
  }

  const currentEndpoint = API_ENDPOINTS[selectedCategory as keyof typeof API_ENDPOINTS].endpoints[selectedEndpoint]
  const codeExample = generateCodeExample(currentEndpoint, selectedLanguage, apiKey || 'YOUR_API_KEY')

  // Filter endpoints based on search
  const filteredCategories = Object.entries(API_ENDPOINTS).filter(([, category]) =>
    category.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.endpoints.some(endpoint =>
      endpoint.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      endpoint.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  )

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">API Playground</h1>
            <p className="text-muted-foreground">
              Interactive API documentation with live testing capabilities
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => window.open('https://api.antevus.com', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Full Docs
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Notifications"
              title="Notifications"
              aria-haspopup="menu"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" aria-hidden="true" />
              <span className="sr-only">You have unread notifications</span>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Security Notice */}
      <Card className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
        <div className="p-4 flex items-start gap-3">
          <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-amber-900 dark:text-amber-100">
              Enterprise Security
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              All API requests are encrypted with TLS 1.3, authenticated with HMAC signatures,
              and logged for HIPAA compliance. Rate limiting enforced at 1000 req/min.
            </p>
          </div>
        </div>
      </Card>

      {/* API Key Management */}
      <Card className="mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              <h2 className="text-lg font-semibold">API Authentication</h2>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="test-mode" className="text-sm">Test Mode</Label>
              <Switch
                id="test-mode"
                checked={testMode}
                onCheckedChange={setTestMode}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key or generate a new one"
                className="pr-10"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <Lock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </button>
            </div>
            <Button
              onClick={generateApiKey}
              disabled={isGeneratingKey}
              variant="outline"
            >
              {isGeneratingKey ? 'Generating...' : 'Generate New Key'}
            </Button>
          </div>

          {testMode && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Test mode enabled - requests will use mock data
            </div>
          )}
        </div>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar - Endpoint Explorer */}
        <div className="col-span-3">
          <Card className="h-[800px] overflow-hidden">
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search endpoints..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="overflow-y-auto h-[calc(100%-73px)]">
              {filteredCategories.map(([key, category]) => (
                <div key={key} className="border-b">
                  <div className="p-3 bg-muted/50">
                    <h3 className="font-medium text-sm">{category.title}</h3>
                  </div>
                  <div className="p-2">
                    {category.endpoints.map((endpoint, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedCategory(key)
                          setSelectedEndpoint(idx)
                        }}
                        className={`w-full text-left p-2 rounded-md hover:bg-muted/50 transition-colors ${
                          selectedCategory === key && selectedEndpoint === idx
                            ? 'bg-primary/10 text-primary'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={endpoint.method === 'GET' ? 'default' :
                                   endpoint.method === 'POST' ? 'secondary' : 'destructive'}
                            className="text-xs"
                          >
                            {endpoint.method}
                          </Badge>
                          <span className="text-sm font-mono truncate">
                            {endpoint.path}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {endpoint.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Main Content Area */}
        <div className="col-span-9">
          <Card className="h-[800px] overflow-hidden">
            <Tabs defaultValue="documentation" className="h-full">
              <div className="border-b px-6">
                <TabsList className="h-12">
                  <TabsTrigger value="documentation">Documentation</TabsTrigger>
                  <TabsTrigger value="try-it">Try It</TabsTrigger>
                  <TabsTrigger value="code">Code Examples</TabsTrigger>
                  <TabsTrigger value="response">Response</TabsTrigger>
                </TabsList>
              </div>

              <div className="overflow-y-auto h-[calc(100%-49px)]">
                {/* Documentation Tab */}
                <TabsContent value="documentation" className="p-6">
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <Badge
                          variant={currentEndpoint.method === 'GET' ? 'default' :
                                 currentEndpoint.method === 'POST' ? 'secondary' : 'destructive'}
                        >
                          {currentEndpoint.method}
                        </Badge>
                        <code className="text-lg font-mono">{currentEndpoint.path}</code>
                      </div>
                      <p className="text-muted-foreground">
                        {currentEndpoint.description}
                      </p>
                    </div>

                    {/* Parameters */}
                    {currentEndpoint.params && (
                      <div>
                        <h3 className="font-semibold mb-3">Parameters</h3>

                        {'path' in currentEndpoint.params && currentEndpoint.params.path && (
                          <div className="mb-4">
                            <h4 className="text-sm font-medium text-muted-foreground mb-2">Path Parameters</h4>
                            <div className="space-y-2">
                              {('path' in currentEndpoint.params && currentEndpoint.params.path ? currentEndpoint.params.path : []).map((param: any, idx: number) => (
                                <div key={idx} className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <code className="text-sm font-mono">{param.name}</code>
                                      <Badge variant="outline" className="text-xs">
                                        {param.type}
                                      </Badge>
                                      {param.required && (
                                        <Badge variant="destructive" className="text-xs">
                                          Required
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {param.description}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {'query' in currentEndpoint.params && currentEndpoint.params.query && (
                          <div className="mb-4">
                            <h4 className="text-sm font-medium text-muted-foreground mb-2">Query Parameters</h4>
                            <div className="space-y-2">
                              {('query' in currentEndpoint.params && currentEndpoint.params.query ? currentEndpoint.params.query : []).map((param: any, idx: number) => (
                                <div key={idx} className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <code className="text-sm font-mono">{param.name}</code>
                                      <Badge variant="outline" className="text-xs">
                                        {param.type}
                                      </Badge>
                                      {param.required && (
                                        <Badge variant="destructive" className="text-xs">
                                          Required
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {param.description}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {'body' in currentEndpoint.params && currentEndpoint.params.body && (
                          <div>
                            <h4 className="text-sm font-medium text-muted-foreground mb-2">Request Body</h4>
                            <div className="p-3 bg-muted/50 rounded-md">
                              <pre className="text-sm">
                                <code>{JSON.stringify('body' in currentEndpoint.params ? currentEndpoint.params.body : {}, null, 2)}</code>
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Response */}
                    {'response' in currentEndpoint && currentEndpoint.response && (
                      <div>
                        <h3 className="font-semibold mb-3">Response</h3>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="default">
                              {'response' in currentEndpoint && currentEndpoint.response ? currentEndpoint.response.success.code : 200}
                            </Badge>
                            <span className="text-sm text-muted-foreground">Success</span>
                          </div>
                          <div className="p-3 bg-muted/50 rounded-md">
                            <pre className="text-sm overflow-x-auto">
                              <code>{JSON.stringify('response' in currentEndpoint && currentEndpoint.response ? currentEndpoint.response.success.body : {}, null, 2)}</code>
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Try It Tab */}
                <TabsContent value="try-it" className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Test this endpoint</h3>
                      <Button>
                        <Activity className="h-4 w-4 mr-2" />
                        Send Request
                      </Button>
                    </div>

                    <div className="p-4 bg-muted/50 rounded-md">
                      <p className="text-sm text-muted-foreground">
                        Configure your request parameters above and click &quot;Send Request&quot; to test the endpoint.
                        Responses will appear in the Response tab.
                      </p>
                    </div>
                  </div>
                </TabsContent>

                {/* Code Examples Tab */}
                <TabsContent value="code" className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Code Examples</h3>
                      <div className="flex items-center gap-2">
                        <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="python">Python</SelectItem>
                            <SelectItem value="javascript">JavaScript</SelectItem>
                            <SelectItem value="curl">cURL</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(codeExample)}
                        >
                          {copiedCode ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="relative">
                      <pre className="p-4 bg-muted/50 rounded-md overflow-x-auto">
                        <code className="text-sm">{codeExample}</code>
                      </pre>
                    </div>
                  </div>
                </TabsContent>

                {/* Response Tab */}
                <TabsContent value="response" className="p-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Response</h3>
                    <div className="p-4 bg-muted/50 rounded-md">
                      <p className="text-sm text-muted-foreground">
                        Send a request from the &ldquo;Try It&rdquo; tab to see the response here.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  )
}