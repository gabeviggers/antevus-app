'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { ArrowLeft, Eye, EyeOff, RefreshCw, Copy, Check, Info } from 'lucide-react'
import { logger } from '@/lib/logger'

interface Endpoint {
  name: string
  method: string
  path: string
  category: string
  description: string
}

const endpoints: Endpoint[] = [
  { name: 'Instruments', method: 'GET/POST', path: '/v1/instruments', category: 'Core', description: 'List and manage lab devices' },
  { name: 'Runs', method: 'GET/POST', path: '/v1/runs', category: 'Core', description: 'Start and track experiments' },
  { name: 'Run Data', method: 'GET', path: '/v1/runs/{id}/data', category: 'Core', description: 'Download experiment results' },
  { name: 'Reports', method: 'POST', path: '/v1/reports', category: 'Core', description: 'Generate QC and compliance reports' },
  { name: 'Events', method: 'WS', path: '/v1/events', category: 'Real-time', description: 'Stream live instrument updates' },
  { name: 'Webhooks', method: 'POST', path: '/v1/webhooks', category: 'Real-time', description: 'Get notified when runs complete' },
  { name: 'Lab Assistant', method: 'WS', path: '/lab-assistant/chat', category: 'AI', description: 'Natural language control' },
  { name: 'Data Ingest', method: 'POST', path: '/v1/ingest', category: 'Data', description: 'Send instrument data to cloud' },
  { name: 'Control', method: 'POST', path: '/v1/control/start', category: 'Phase 2', description: 'Remote instrument control' }
]

export default function EndpointsConfigPage() {
  const [apiKeyRevealed, setApiKeyRevealed] = useState(false)
  const [webhookSecretRevealed, setWebhookSecretRevealed] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [hoveredEndpoint, setHoveredEndpoint] = useState<number | null>(null)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Function to generate random API key
  const generateApiKey = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let key = 'ant_live_'
    for (let i = 0; i < 24; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return key
  }

  // Function to generate random webhook secret
  const generateWebhookSecret = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let secret = 'whsec_'
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return secret
  }

  // State for credentials
  const [apiKey, setApiKey] = useState(() => generateApiKey())
  const [webhookSecret, setWebhookSecret] = useState(() => generateWebhookSecret())

  const baseUrl = 'https://api.antevus.com'
  const wsUrl = 'wss://api.antevus.com'

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const sendTestEvent = () => {
    setTestStatus('testing')
    setTimeout(() => {
      setTestStatus('success')
    }, 1500)
  }

  const handleContinue = async () => {
    setIsLoading(true)
    try {
      // Update progress via secure API
      await fetch('/api/onboarding/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'endpoints',
          completed: true
        })
      })

      // Get user role from the role API
      const roleResponse = await fetch('/api/onboarding/role')
      const roleData = await roleResponse.json()

      const userRole = roleData.role || 'scientist' // Default to scientist if no role

      logger.info('Endpoints: Checking user role for navigation', {
        userRole,
        roleData,
        isAdmin: userRole === 'admin' || userRole === 'lab_manager'
      })

      if (userRole === 'admin' || userRole === 'lab_manager') {
        // Admins/Lab Managers go to team invite
        logger.info('Endpoints: Navigating admin to team page')
        router.push('/onboarding/team')
      } else {
        // Everyone else (scientist, developer) goes to hello workflow
        logger.info('Endpoints: Navigating non-admin to hello page')
        router.push('/onboarding/hello')
      }
    } catch (error) {
      logger.error('Failed to update progress', error)
      setIsLoading(false)
    }
  }

  const getFullUrl = (endpoint: Endpoint) => {
    if (endpoint.method === 'WS') {
      return wsUrl + endpoint.path
    }
    return baseUrl + endpoint.path
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 flex justify-between items-center p-6">
        <button
          onClick={() => router.push('/onboarding/instruments')}
          className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </button>
        <ThemeToggle />
      </header>

      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
        <div className="h-full w-4/5 bg-foreground transition-all duration-300" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-4xl space-y-4">
          {/* Step Indicator */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Step 4 of 5
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Endpoints & Webhooks
            </h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl mx-auto">
              Save your API credentials securely in a .env file. Copy the endpoint URLs to integrate with your code.
              Use these to connect instruments, stream data, and receive real-time notifications.
            </p>
          </div>

          {/* Two Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column - Credentials */}
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Credentials</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Save these securely in your .env file or secrets manager.
                </p>
              </div>

              {/* API Key - Compact */}
              <div className="p-2 rounded border border-border bg-card">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">API Key</p>
                    <code className="text-xs font-mono text-muted-foreground block truncate">
                      {apiKeyRevealed ? apiKey : '•'.repeat(28)}
                    </code>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Authenticates your API requests
                    </p>
                  </div>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => copyToClipboard(apiKey, 'apikey')}
                      className="p-1 rounded hover:bg-accent transition-colors"
                      title="Copy"
                    >
                      {copiedField === 'apikey' ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                    <button
                      onClick={() => setApiKeyRevealed(!apiKeyRevealed)}
                      className="p-1 rounded hover:bg-accent transition-colors"
                      title={apiKeyRevealed ? 'Hide' : 'Reveal'}
                    >
                      {apiKeyRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                    <button
                      onClick={() => {
                        setApiKey(generateApiKey())
                        setCopiedField(null)
                      }}
                      className="p-1 rounded hover:bg-accent transition-colors"
                      title="Rotate"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Webhook Secret - Compact */}
              <div className="p-2 rounded border border-border bg-card">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">Webhook Secret</p>
                    <code className="text-xs font-mono text-muted-foreground block truncate">
                      {webhookSecretRevealed ? webhookSecret : '•'.repeat(32)}
                    </code>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Verifies webhook payloads are from Antevus
                    </p>
                  </div>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => copyToClipboard(webhookSecret, 'webhooksecret')}
                      className="p-1 rounded hover:bg-accent transition-colors"
                      title="Copy"
                    >
                      {copiedField === 'webhooksecret' ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                    <button
                      onClick={() => setWebhookSecretRevealed(!webhookSecretRevealed)}
                      className="p-1 rounded hover:bg-accent transition-colors"
                      title={webhookSecretRevealed ? 'Hide' : 'Reveal'}
                    >
                      {webhookSecretRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                    <button
                      onClick={() => {
                        setWebhookSecret(generateWebhookSecret())
                        setCopiedField(null)
                      }}
                      className="p-1 rounded hover:bg-accent transition-colors"
                      title="Rotate"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* HMAC Header */}
              <div className="p-2 rounded border border-border bg-card">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">Webhook Header</p>
                    <code className="text-xs font-mono text-muted-foreground block truncate">
                      X-Antevus-Signature: {'{hmac}'}
                    </code>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Add to webhook handler for signature validation
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard('X-Antevus-Signature: {hmac}', 'header')}
                    className="p-1 rounded hover:bg-accent transition-colors"
                    title="Copy"
                  >
                    {copiedField === 'header' ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>

              {/* Test Button */}
              <button
                onClick={sendTestEvent}
                disabled={testStatus === 'testing'}
                className="w-full py-1.5 px-2 rounded border border-border text-xs hover:bg-accent transition-colors disabled:opacity-50"
              >
                {testStatus === 'testing' ? 'Testing...' : 'Send Test Event'}
              </button>

              {testStatus === 'success' && (
                <p className="text-center text-xs text-green-600">
                  ✅ Success: 200 OK, HMAC valid
                </p>
              )}
            </div>

            {/* Right Column - Endpoints Grid */}
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">API Endpoints</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Copy these URLs to integrate with your code and tools.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {endpoints.map((endpoint, idx) => (
                  <div
                    key={idx}
                    className={`relative p-2 rounded border border-border bg-card hover:bg-accent/30 transition-colors ${
                      endpoint.category === 'Phase 2' ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          <p className="text-xs font-medium truncate">{endpoint.name}</p>
                          <span className="text-[10px] text-muted-foreground">
                            {endpoint.method}
                          </span>
                        </div>
                        <code className="text-[10px] text-muted-foreground block truncate">
                          {endpoint.path}
                        </code>
                      </div>
                      <div className="flex gap-0.5 flex-shrink-0">
                        {/* Info Icon - Always Visible */}
                        <div className="relative">
                          <button
                            onMouseEnter={() => setHoveredEndpoint(idx)}
                            onMouseLeave={() => setHoveredEndpoint(null)}
                            className="p-0.5 rounded hover:bg-accent/50 transition-all"
                            type="button"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                          {/* Tooltip */}
                          {hoveredEndpoint === idx && (
                            <div className="absolute z-50 bottom-full mb-2 right-0 px-2 py-1 bg-popover text-popover-foreground border rounded-md shadow-md whitespace-nowrap">
                              <p className="text-xs">{endpoint.description}</p>
                            </div>
                          )}
                        </div>

                        {/* Copy Icon - Always Visible */}
                        {endpoint.category !== 'Phase 2' && (
                          <button
                            onClick={() => copyToClipboard(getFullUrl(endpoint), `endpoint-${idx}`)}
                            className="p-0.5 rounded hover:bg-accent/50 transition-all"
                            type="button"
                          >
                            {copiedField === `endpoint-${idx}` ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Continue Button */}
          <div className="flex justify-end">
            <button
              onClick={handleContinue}
              disabled={isLoading}
              className="px-6 py-2 rounded-md text-sm font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Loading...' : 'Continue →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}