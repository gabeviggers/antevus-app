'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { useTheme } from 'next-themes'
import { ArrowLeft } from 'lucide-react'

export default function ProfileSetupPage() {
  const [name, setName] = useState('')
  const [organization, setOrganization] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  const [notifications, setNotifications] = useState(false)
  const [privacy, setPrivacy] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  // Handle hydration
  useEffect(() => {
    setMounted(true)
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    setTimezone(userTimezone)
  }, [])


  const handleContinue = async () => {
    if (!name || !organization) return

    setIsLoading(true)

    // Save profile data (would call API in production)
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboarding_profile', JSON.stringify({
        name,
        organization,
        timezone,
        notifications,
        privacy,
        theme
      }))
    }

    // Navigate to agent installation
    router.push('/onboarding/agent')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 flex justify-between items-center p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </button>
        <ThemeToggle />
      </header>

      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
        <div className="h-full w-1/5 bg-foreground transition-all duration-300" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Step Indicator */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Step 1 of 5
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Complete your profile
            </h2>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Name *
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                placeholder="John Smith"
              />
            </div>

            {/* Organization */}
            <div>
              <label htmlFor="organization" className="block text-sm font-medium mb-2">
                Organization Name *
              </label>
              <input
                id="organization"
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                placeholder="Acme Laboratories"
              />
            </div>

            {/* Timezone */}
            <div>
              <label htmlFor="timezone" className="block text-sm font-medium mb-2">
                Time Zone *
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
              >
                <option value="America/New_York">America/New_York</option>
                <option value="America/Chicago">America/Chicago</option>
                <option value="America/Denver">America/Denver</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Europe/Paris">Europe/Paris</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
                <option value="Asia/Singapore">Asia/Singapore</option>
                <option value="Australia/Sydney">Australia/Sydney</option>
              </select>
            </div>

            {/* Appearance */}
            {mounted && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Appearance
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="theme"
                      value="light"
                      checked={theme === 'light'}
                      onChange={() => setTheme('light')}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 mr-2 transition-colors ${
                      theme === 'light' ? 'border-foreground bg-foreground' : 'border-muted-foreground'
                    }`}>
                      {theme === 'light' && (
                        <div className="w-full h-full rounded-full flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-background" />
                        </div>
                      )}
                    </div>
                    <span className="text-sm">Light</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="theme"
                      value="dark"
                      checked={theme === 'dark'}
                      onChange={() => setTheme('dark')}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 mr-2 transition-colors ${
                      theme === 'dark' ? 'border-foreground bg-foreground' : 'border-muted-foreground'
                    }`}>
                      {theme === 'dark' && (
                        <div className="w-full h-full rounded-full flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-background" />
                        </div>
                      )}
                    </div>
                    <span className="text-sm">Dark</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="theme"
                      value="system"
                      checked={theme === 'system'}
                      onChange={() => setTheme('system')}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 mr-2 transition-colors ${
                      theme === 'system' ? 'border-foreground bg-foreground' : 'border-muted-foreground'
                    }`}>
                      {theme === 'system' && (
                        <div className="w-full h-full rounded-full flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-background" />
                        </div>
                      )}
                    </div>
                    <span className="text-sm">System</span>
                  </label>
                </div>
              </div>
            )}

            {/* Desktop Notifications */}
            <div>
              <label className="block text-sm font-medium mb-3">
                Desktop Notifications
              </label>
              <div className="space-y-3">
                {/* Enable notifications toggle */}
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm">Enable desktop notifications</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifications}
                    onClick={() => setNotifications(!notifications)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      notifications ? 'bg-foreground' : 'bg-muted'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                      notifications ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </label>

                {/* Privacy toggle - indented when notifications enabled */}
                {notifications && (
                  <div className="pl-4 space-y-2">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm">Privacy: No previews</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={privacy}
                        onClick={() => setPrivacy(!privacy)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          privacy ? 'bg-foreground' : 'bg-muted'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                          privacy ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </label>
                    <p className="text-xs text-muted-foreground flex items-center">
                      <span className="mr-1">ℹ️</span>
                      Hides sensitive content in notifications
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            disabled={!name || !organization || isLoading}
            className="w-full py-2.5 px-4 rounded-md text-sm font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Saving...' : 'Save & Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}