'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { useTheme } from 'next-themes'
import { ArrowLeft, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { logger } from '@/lib/logger'

export default function ProfileSetupPage() {
  // Form state
  const [name, setName] = useState('')
  const [organization, setOrganization] = useState('')
  const [department, setDepartment] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  const [notifications, setNotifications] = useState(false)
  const [privacy, setPrivacy] = useState(true)

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [mounted, setMounted] = useState(false)

  const router = useRouter()
  const { theme, setTheme } = useTheme()

  // Load existing profile data from secure API
  useEffect(() => {
    const loadProfileData = async () => {
      setIsLoadingData(true)
      try {
        const response = await fetch('/api/onboarding/profile', {
          method: 'GET',
          credentials: 'include', // Include httpOnly cookies
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const data = await response.json()

          if (data.profileData) {
            // Pre-fill form with existing data
            setName(data.profileData.name || '')
            setOrganization(data.profileData.organization || '')
            setDepartment(data.profileData.department || '')
            setTimezone(data.profileData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone)
            setNotifications(data.profileData.notifications || false)
            setPrivacy(data.profileData.privacy || true)
            if (data.profileData.theme) {
              setTheme(data.profileData.theme)
            }
          }
        }
      } catch (err) {
        logger.error('Failed to load profile data', err)
        // Don't show error for initial load failure
      } finally {
        setIsLoadingData(false)
      }
    }

    loadProfileData()
  }, [setTheme])

  // Handle hydration and timezone detection
  useEffect(() => {
    setMounted(true)
    if (!timezone) {
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      setTimezone(userTimezone)
    }
  }, [timezone])

  const validateForm = () => {
    if (!name.trim()) {
      setError('Name is required')
      return false
    }
    if (!organization.trim()) {
      setError('Organization is required')
      return false
    }
    if (name.length > 100) {
      setError('Name is too long (max 100 characters)')
      return false
    }
    if (organization.length > 200) {
      setError('Organization name is too long (max 200 characters)')
      return false
    }
    if (!/^[a-zA-Z\s\-'\.]+$/.test(name)) {
      setError('Name contains invalid characters')
      return false
    }
    return true
  }

  const handleContinue = async () => {
    // Clear previous errors
    setError('')

    // Validate form
    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      // ✅ SECURE: Use server API instead of localStorage
      const response = await fetch('/api/onboarding/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include httpOnly session cookies
        body: JSON.stringify({
          name: name.trim(),
          organization: organization.trim(),
          department: department.trim(),
          timezone,
          notifications,
          privacy,
          theme: theme || 'system'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save profile')
      }

      // Show success message
      setSuccess(true)

      // Log success for debugging (no sensitive data)
      logger.info('Profile saved successfully', {
        nextStep: data.nextStep,
        progress: data.progress
      })

      // Navigate to next step based on server response
      setTimeout(() => {
        router.push(`/onboarding/${data.nextStep || 'instruments'}`)
      }, 500)

    } catch (err) {
      logger.error('Profile save error', err)
      setError(err instanceof Error ? err.message : 'Failed to save profile. Please try again.')
      setSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    router.push('/onboarding/role')
  }

  // Don't render until mounted (prevents hydration issues)
  if (!mounted || isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Progress bar */}
      <div className="w-full bg-muted">
        <div className="h-1.5 bg-primary transition-all duration-500" style={{ width: '20%' }} />
      </div>

      {/* Header */}
      <div className="border-b bg-card">
        <div className="container max-w-4xl mx-auto px-4 py-3">
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
              Step 1 of 5
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Main content - centered vertically */}
      <div className="flex-1 overflow-y-auto flex items-center">
        <div className="container max-w-2xl mx-auto px-4 py-4 w-full">
          {/* Title - centered */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">Complete Your Profile</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Let&apos;s get to know you and your organization
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
                <p className="text-sm font-medium text-green-600">Profile saved successfully!</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={(e) => { e.preventDefault(); handleContinue(); }} className="space-y-4">
            <div className="space-y-3">
              {/* Two column layout for desktop, single column for mobile */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1.5">
                    Full Name *
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-3 py-1.5 text-sm border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-primary"
                    required
                    disabled={isLoading}
                    maxLength={100}
                  />
                </div>

                <div>
                  <label htmlFor="org" className="block text-sm font-medium mb-1.5">
                    Organization *
                  </label>
                  <input
                    id="org"
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="Antevus Laboratories"
                    className="w-full px-3 py-1.5 text-sm border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-primary"
                    required
                    disabled={isLoading}
                    maxLength={200}
                  />
                </div>

                <div>
                  <label htmlFor="dept" className="block text-sm font-medium mb-1.5">
                    Department / Role
                  </label>
                  <select
                    id="dept"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-primary"
                    disabled={isLoading}
                  >
                    <option value="">Select your department</option>
                    <option value="Admin/Manager">Admin/Manager</option>
                    <option value="Developer/Engineer">Developer/Engineer</option>
                    <option value="Scientist/Researcher">Scientist/Researcher</option>
                    <option value="Lab Technician">Lab Technician</option>
                    <option value="Quality Assurance">Quality Assurance</option>
                    <option value="Compliance Officer">Compliance Officer</option>
                    <option value="Data Analyst">Data Analyst</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="timezone" className="block text-sm font-medium mb-1.5">
                    Timezone
                  </label>
                  <select
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-primary"
                    disabled={isLoading}
                  >
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="Europe/London">London (GMT)</option>
                    <option value="Europe/Paris">Paris (CET)</option>
                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                    <option value="Asia/Shanghai">Shanghai (CST)</option>
                    <option value="Australia/Sydney">Sydney (AEDT)</option>
                  </select>
                </div>
              </div>

              {/* Preferences - Compact checkboxes */}
              <div className="border-t pt-3 mt-3 space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications}
                    onChange={(e) => setNotifications(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
                    disabled={isLoading}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Email Notifications</div>
                    <div className="text-xs text-muted-foreground">
                      Receive updates about instruments and runs
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privacy}
                    onChange={(e) => setPrivacy(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
                    disabled={isLoading}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Enhanced Privacy</div>
                    <div className="text-xs text-muted-foreground">
                      Enable HIPAA compliance features
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Continue button */}
            <div className="flex justify-end pt-4 border-t">
              <button
                type="submit"
                disabled={!name.trim() || !organization.trim() || isLoading}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save & Continue'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}