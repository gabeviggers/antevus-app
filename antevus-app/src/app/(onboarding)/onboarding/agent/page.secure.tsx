'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { Check, Copy, RefreshCw, ArrowLeft, Loader2, AlertCircle, CheckCircle, Monitor, Apple, Terminal } from 'lucide-react'
import { logger } from '@/lib/logger'

type Platform = 'windows' | 'mac' | 'linux'

interface AgentConfig {
  enableAutomation: boolean
  enableAI: boolean
  automationLevel: 'basic' | 'advanced' | 'expert'
  notifications: {
    email: boolean
    slack: boolean
    webhook: boolean
  }
  preferences: {
    autoRetry: boolean
    maxRetries: number
    timeoutSeconds: number
    queuePriority: 'low' | 'normal' | 'high'
  }
}

export default function AgentInstallPage() {
  const [joinToken] = useState('ANT-XY7K-9PQ2-MNBV')
  const [copied, setCopied] = useState(false)
  const [agentStatus, setAgentStatus] = useState<'waiting' | 'connecting' | 'connected'>('waiting')
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Agent configuration
  const [enableAutomation, setEnableAutomation] = useState(true)
  const [enableAI, setEnableAI] = useState(false)
  const [automationLevel, setAutomationLevel] = useState<'basic' | 'advanced' | 'expert'>('basic')
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [slackNotifications, setSlackNotifications] = useState(false)

  const router = useRouter()

  // Load existing agent configuration from API
  useEffect(() => {
    const loadAgentData = async () => {
      setIsLoadingData(true)
      try {
        const response = await fetch('/api/onboarding/agent', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const data = await response.json()

          if (data.agentData) {
            // Pre-fill form with existing data
            setEnableAutomation(data.agentData.enableAutomation || false)
            setEnableAI(data.agentData.enableAI || false)
            setAutomationLevel(data.agentData.automationLevel || 'basic')
            setEmailNotifications(data.agentData.notifications?.email || true)
            setSlackNotifications(data.agentData.notifications?.slack || false)

            // If already configured, show as connected
            if (data.agentData.enableAutomation) {
              setAgentStatus('connected')
            }
          }
        }
      } catch (err) {
        logger.error('Failed to load agent data', err)
      } finally {
        setIsLoadingData(false)
      }
    }

    loadAgentData()
  }, [])

  // Simulate agent connection in development
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    let timeout: NodeJS.Timeout
    if (copied && agentStatus === 'waiting') {
      timeout = setTimeout(() => {
        setAgentStatus('connecting')
        setTimeout(() => {
          setAgentStatus('connected')
        }, 2000)
      }, 3000)
    }

    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [copied, agentStatus])

  const copyToken = () => {
    navigator.clipboard.writeText(joinToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSkip = async () => {
    setIsLoading(true)
    setError('')

    try {
      // Save minimal agent configuration with automation disabled
      const response = await fetch('/api/onboarding/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          enableAutomation: false,
          enableAI: false,
          automationLevel: 'basic',
          notifications: {
            email: false,
            slack: false,
            webhook: false
          },
          preferences: {
            autoRetry: false,
            maxRetries: 1,
            timeoutSeconds: 120,
            queuePriority: 'normal'
          }
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to skip agent setup')
      }

      logger.info('Agent setup skipped', { nextStep: data.nextStep })
      router.push(`/onboarding/${data.nextStep || 'endpoints'}`)

    } catch (err) {
      logger.error('Failed to skip agent setup', err)
      setError(err instanceof Error ? err.message : 'Failed to skip. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleContinue = async () => {
    setIsLoading(true)
    setError('')

    try {
      // ✅ SECURE: Save agent configuration to server API
      const agentConfig: AgentConfig = {
        enableAutomation,
        enableAI,
        automationLevel,
        notifications: {
          email: emailNotifications,
          slack: slackNotifications,
          webhook: false
        },
        preferences: {
          autoRetry: true,
          maxRetries: 3,
          timeoutSeconds: 120,
          queuePriority: automationLevel === 'expert' ? 'high' : 'normal'
        }
      }

      const response = await fetch('/api/onboarding/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(agentConfig)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save agent configuration')
      }

      setSuccess(true)

      logger.info('Agent configuration saved', {
        automationEnabled: enableAutomation,
        nextStep: data.nextStep
      })

      // Navigate to next step
      setTimeout(() => {
        router.push(`/onboarding/${data.nextStep || 'endpoints'}`)
      }, 500)

    } catch (err) {
      logger.error('Agent configuration error', err)
      setError(err instanceof Error ? err.message : 'Failed to save configuration. Please try again.')
      setSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    router.push('/onboarding/instruments')
  }

  const getPlatformCommand = (platform: Platform) => {
    const baseCommand = `curl -sSL https://get.antevus.com/agent | sh -s -- --token ${joinToken}`

    switch (platform) {
      case 'windows':
        return `iwr -useb https://get.antevus.com/agent.ps1 | iex -token ${joinToken}`
      case 'mac':
        return baseCommand
      case 'linux':
        return baseCommand
      default:
        return baseCommand
    }
  }

  if (isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Progress bar */}
      <div className="w-full bg-muted">
        <div className="h-2 bg-primary transition-all duration-500" style={{ width: '60%' }} />
      </div>

      {/* Header */}
      <div className="border-b bg-card">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              disabled={isLoading}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div className="text-sm text-muted-foreground">
              Step 3 of 5
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 container max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Configure Automation Agent</h1>
            <p className="text-muted-foreground">
              Install our edge agent to enable automation and real-time monitoring
            </p>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-600">Agent configuration saved!</p>
              </div>
            </div>
          )}

          {/* Agent Status */}
          <div className="bg-muted/50 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Agent Status</h2>
              <div className="flex items-center gap-2">
                {agentStatus === 'waiting' && (
                  <>
                    <div className="w-2 h-2 bg-gray-400 rounded-full" />
                    <span className="text-sm text-muted-foreground">Waiting for agent</span>
                  </>
                )}
                {agentStatus === 'connecting' && (
                  <>
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                    <span className="text-sm text-yellow-600">Connecting...</span>
                  </>
                )}
                {agentStatus === 'connected' && (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-sm text-green-600">Connected</span>
                  </>
                )}
              </div>
            </div>

            {/* Join Token */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Join Token</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-4 py-2 bg-background border rounded-md font-mono text-sm">
                    {joinToken}
                  </code>
                  <button
                    onClick={copyToken}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Platform Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Select Your Platform</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setSelectedPlatform('windows')}
                    className={`p-4 border rounded-lg transition-all ${
                      selectedPlatform === 'windows'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Monitor className="h-6 w-6 mx-auto mb-2" />
                    <span className="text-sm">Windows</span>
                  </button>
                  <button
                    onClick={() => setSelectedPlatform('mac')}
                    className={`p-4 border rounded-lg transition-all ${
                      selectedPlatform === 'mac'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Apple className="h-6 w-6 mx-auto mb-2" />
                    <span className="text-sm">macOS</span>
                  </button>
                  <button
                    onClick={() => setSelectedPlatform('linux')}
                    className={`p-4 border rounded-lg transition-all ${
                      selectedPlatform === 'linux'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Terminal className="h-6 w-6 mx-auto mb-2" />
                    <span className="text-sm">Linux</span>
                  </button>
                </div>
              </div>

              {/* Installation Command */}
              {selectedPlatform && (
                <div>
                  <label className="block text-sm font-medium mb-2">Installation Command</label>
                  <div className="p-4 bg-background border rounded-md">
                    <code className="text-xs font-mono break-all">
                      {getPlatformCommand(selectedPlatform)}
                    </code>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Automation Configuration */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Automation Settings</h2>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableAutomation}
                  onChange={(e) => setEnableAutomation(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div>
                  <div className="font-medium">Enable Automation</div>
                  <div className="text-sm text-muted-foreground">
                    Allow the agent to automatically start runs and manage instruments
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableAI}
                  onChange={(e) => setEnableAI(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div>
                  <div className="font-medium">Enable AI Assistant</div>
                  <div className="text-sm text-muted-foreground">
                    Use AI to optimize run parameters and detect anomalies
                  </div>
                </div>
              </label>
            </div>

            {enableAutomation && (
              <div>
                <label className="block text-sm font-medium mb-2">Automation Level</label>
                <select
                  value={automationLevel}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onChange={(e) => setAutomationLevel(e.target.value as any)}
                  className="w-full px-4 py-2 border rounded-lg bg-background"
                >
                  <option value="basic">Basic - Manual approval required</option>
                  <option value="advanced">Advanced - Auto-approve routine tasks</option>
                  <option value="expert">Expert - Full automation</option>
                </select>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-medium">Notification Preferences</h3>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm">Email notifications</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={slackNotifications}
                  onChange={(e) => setSlackNotifications(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm">Slack notifications</span>
              </label>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4">
            <button
              onClick={handleSkip}
              disabled={isLoading}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now
            </button>

            <button
              onClick={handleContinue}
              disabled={isLoading || (agentStatus === 'waiting' && !enableAutomation)}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : agentStatus === 'connected' || enableAutomation ? (
                'Continue'
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Waiting for agent...
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}