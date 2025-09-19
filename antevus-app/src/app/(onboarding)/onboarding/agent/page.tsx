'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { Check, Copy, RefreshCw, ArrowLeft } from 'lucide-react'

type Platform = 'windows' | 'mac' | 'linux'

export default function AgentInstallPage() {
  const [joinToken] = useState('ANT-XY7K-9PQ2-MNBV')
  const [copied, setCopied] = useState(false)
  const [agentStatus, setAgentStatus] = useState<'waiting' | 'connecting' | 'connected'>('waiting')
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // In development, auto-connect after copying token (simulates real agent)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    let timeout: NodeJS.Timeout
    if (copied) {
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
  }, [copied])

  const copyToken = () => {
    navigator.clipboard.writeText(joinToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSkip = () => {
    setIsLoading(true)
    // Move to endpoints configuration (step 4)
    router.push('/onboarding/endpoints')
  }

  const handleContinue = () => {
    setIsLoading(true)
    // Move to endpoints configuration (step 4)
    router.push('/onboarding/endpoints')
  }

  const getDownloadLink = (platform: Platform) => {
    // In production, these would be real download links
    const links = {
      windows: '/downloads/antevus-agent-win.exe',
      mac: '/downloads/antevus-agent-mac.pkg',
      linux: '/downloads/antevus-agent-linux.deb'
    }
    return links[platform]
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Progress bar */}
      <div className="w-full bg-muted">
        <div className="h-1.5 bg-primary transition-all duration-500" style={{ width: '60%' }} />
      </div>

      {/* Header */}
      <div className="border-b bg-card">
        <div className="container max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/onboarding/instruments')}
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

      {/* Main content - scrollable if needed */}
      <div className="flex-1 overflow-y-auto">
        <div className="container max-w-2xl mx-auto px-4 py-4 h-full flex flex-col">
          {/* Title - compact */}
          <div className="text-center mb-3">
            <h1 className="text-2xl font-bold">Connect the Edge Agent</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Install our agent to discover instruments automatically
            </p>
          </div>

          {/* Platform Selection - more compact */}
          <div className="mb-3">
            <p className="text-sm text-muted-foreground mb-2">
              Download for your platform:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setSelectedPlatform('windows')}
                className={`p-3 rounded-md border transition-colors ${
                  selectedPlatform === 'windows'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent/50'
                }`}
              >
                <div className="text-xl mb-0.5">🪟</div>
                <div className="text-xs">Windows</div>
              </button>
              <button
                onClick={() => setSelectedPlatform('mac')}
                className={`p-3 rounded-md border transition-colors ${
                  selectedPlatform === 'mac'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent/50'
                }`}
              >
                <div className="text-xl mb-0.5">🍎</div>
                <div className="text-xs">Mac</div>
              </button>
              <button
                onClick={() => setSelectedPlatform('linux')}
                className={`p-3 rounded-md border transition-colors ${
                  selectedPlatform === 'linux'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent/50'
                }`}
              >
                <div className="text-xl mb-0.5">🐧</div>
                <div className="text-xs">Linux</div>
              </button>
            </div>
            {selectedPlatform && (
              <a
                href={getDownloadLink(selectedPlatform)}
                className="mt-2 block w-full py-1.5 px-3 rounded-md border border-border text-center text-sm hover:bg-accent transition-colors"
                download
              >
                Download for {selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)}
              </a>
            )}
          </div>

          {/* Join Token - more compact */}
          <div className="mb-3">
            <p className="text-sm text-muted-foreground mb-1.5">
              Your Join Token (expires in 30 min)
            </p>
            <div className="flex items-center space-x-2 p-2.5 rounded-md border border-border bg-muted/50">
              <code className="flex-1 font-mono text-sm">
                {joinToken}
              </code>
              <button
                onClick={copyToken}
                className="p-2 rounded hover:bg-accent transition-colors"
                title="Copy token"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Installation Steps - more compact */}
          <div className="mb-3">
            <p className="text-sm font-medium mb-1">Installation Steps:</p>
            <ol className="space-y-0.5 text-sm text-muted-foreground">
              <li>1. Install the agent</li>
              <li>2. Paste join token when asked</li>
              <li>3. Agent appears below</li>
            </ol>
          </div>

          {/* Status - more compact */}
          <div className="p-3 rounded-md border border-border bg-card mb-3">
            <div className="flex items-center space-x-3">
              {agentStatus === 'waiting' && (
                <>
                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                  <span className="text-sm">Waiting for agent...</span>
                </>
              )}
              {agentStatus === 'connecting' && (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Connecting...</span>
                </>
              )}
              {agentStatus === 'connected' && (
                <>
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm">✅ Agent connected</span>
                </>
              )}
            </div>
          </div>

          {/* Actions - at bottom */}
          <div className="mt-auto pt-4 border-t">
            {agentStatus === 'connected' ? (
              <button
                onClick={handleContinue}
                disabled={isLoading}
                className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Loading...' : 'Continue →'}
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={handleSkip}
                  disabled={isLoading}
                  className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Loading...' : 'Skip for now →'}
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  Continue without agent installation
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}