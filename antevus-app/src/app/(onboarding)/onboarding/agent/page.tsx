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
    router.push('/onboarding/instruments')
  }

  const handleContinue = () => {
    setIsLoading(true)
    router.push('/onboarding/instruments')
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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 flex justify-between items-center p-6">
        <button
          onClick={() => router.push('/onboarding/profile')}
          className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </button>
        <ThemeToggle />
      </header>

      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
        <div className="h-full w-2/5 bg-foreground transition-all duration-300" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Step Indicator */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Step 2 of 5
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Connect the Edge Agent
            </h2>
          </div>

          {/* Platform Selection */}
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Download for your platform:
            </p>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setSelectedPlatform('windows')}
                className={`p-4 rounded-md border transition-colors ${
                  selectedPlatform === 'windows'
                    ? 'border-foreground bg-accent'
                    : 'border-border hover:bg-accent/50'
                }`}
              >
                <div className="text-2xl mb-1">🪟</div>
                <div className="text-xs">Windows</div>
              </button>
              <button
                onClick={() => setSelectedPlatform('mac')}
                className={`p-4 rounded-md border transition-colors ${
                  selectedPlatform === 'mac'
                    ? 'border-foreground bg-accent'
                    : 'border-border hover:bg-accent/50'
                }`}
              >
                <div className="text-2xl mb-1">🍎</div>
                <div className="text-xs">Mac</div>
              </button>
              <button
                onClick={() => setSelectedPlatform('linux')}
                className={`p-4 rounded-md border transition-colors ${
                  selectedPlatform === 'linux'
                    ? 'border-foreground bg-accent'
                    : 'border-border hover:bg-accent/50'
                }`}
              >
                <div className="text-2xl mb-1">🐧</div>
                <div className="text-xs">Linux</div>
              </button>
            </div>
            {selectedPlatform && (
              <a
                href={getDownloadLink(selectedPlatform)}
                className="mt-3 block w-full py-2 px-4 rounded-md border border-border text-center text-sm hover:bg-accent transition-colors"
                download
              >
                Download for {selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)}
              </a>
            )}
          </div>

          {/* Join Token */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Your Join Token (expires in 30 min)
            </p>
            <div className="flex items-center space-x-2 p-3 rounded-md border border-border bg-muted/50">
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

          {/* Installation Steps */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Installation Steps:</p>
            <ol className="space-y-1 text-sm text-muted-foreground">
              <li>1. Install the agent</li>
              <li>2. Paste join token when asked</li>
              <li>3. Agent appears below</li>
            </ol>
          </div>

          {/* Status */}
          <div className="p-4 rounded-md border border-border bg-card">
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

          {/* Actions */}
          <div className="space-y-3">
            {agentStatus === 'connected' ? (
              <button
                onClick={handleContinue}
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-md text-sm font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Loading...' : 'Continue →'}
              </button>
            ) : (
              <>
                <button
                  onClick={handleSkip}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-md text-sm font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Loading...' : 'Skip for now →'}
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  Continue without agent installation
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}