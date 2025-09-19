'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { ArrowLeft, UserPlus, Mail, Check, X, Upload, HelpCircle } from 'lucide-react'

interface TeamMember {
  email: string
  role: 'scientist' | 'developer' | 'manager' | 'compliance'
}

export default function TeamInvitePage() {
  const [emailInput, setEmailInput] = useState('')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [defaultRole, setDefaultRole] = useState<TeamMember['role']>('scientist')
  const [isLoading, setIsLoading] = useState(false)
  const [invitesSent, setInvitesSent] = useState(false)
  const [showCsvHelp, setShowCsvHelp] = useState(false)
  const router = useRouter()

  // Check if user is admin
  useEffect(() => {
    // Check stored role from onboarding
    const userRole = localStorage.getItem('onboarding_role')
    // If not admin/manager, redirect to hello workflow
    if (userRole && userRole !== 'admin' && userRole !== 'manager') {
      router.push('/onboarding/hello')
    }
  }, [router])

  const handleAddEmail = (e?: React.KeyboardEvent<HTMLInputElement>) => {
    if (e && e.key !== 'Enter') return

    const email = emailInput.trim().toLowerCase()
    if (!email) return

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      // Could show error message here
      return
    }

    // Don't add duplicates
    if (!teamMembers.some(m => m.email === email)) {
      setTeamMembers([...teamMembers, { email, role: defaultRole }])
    }
    setEmailInput('')
  }

  const handleRemoveMember = (emailToRemove: string) => {
    setTeamMembers(teamMembers.filter(member => member.email !== emailToRemove))
  }

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text.split('\n').filter(line => line.trim())

      // Check if first line looks like headers
      const firstLine = lines[0].toLowerCase()
      const hasHeaders = firstLine.includes('email') || firstLine.includes('role')
      const dataLines = hasHeaders ? lines.slice(1) : lines

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const newMembers: TeamMember[] = []

      dataLines.forEach(line => {
        const parts = line.split(',').map(p => p.trim())

        // Try to find email and role in the parts
        let email = ''
        let role: TeamMember['role'] = defaultRole

        parts.forEach(part => {
          const cleaned = part.toLowerCase().replace(/["']/g, '')

          // Check if this part is an email
          if (emailRegex.test(cleaned)) {
            email = cleaned
          }
          // Check if this part is a role
          else if (['scientist', 'developer', 'manager', 'compliance'].includes(cleaned)) {
            role = cleaned as TeamMember['role']
          }
          // Check for role aliases
          else if (cleaned === 'admin') {
            role = 'manager'
          } else if (cleaned === 'dev' || cleaned === 'it') {
            role = 'developer'
          } else if (cleaned === 'compliance officer' || cleaned === 'qa') {
            role = 'compliance'
          } else if (cleaned === 'researcher' || cleaned === 'lab') {
            role = 'scientist'
          }
        })

        if (email) {
          newMembers.push({ email, role })
        }
      })

      // Merge with existing, avoiding duplicates
      const existingEmails = new Set(teamMembers.map(m => m.email))
      const uniqueNewMembers = newMembers.filter(m => !existingEmails.has(m.email))
      setTeamMembers([...teamMembers, ...uniqueNewMembers])
    }
    reader.readAsText(file)

    // Reset file input
    e.target.value = ''
  }

  const handleSendInvites = async () => {
    if (teamMembers.length === 0) return

    setIsLoading(true)

    // In production, this would call the API to send invites
    // For now, simulate sending
    setTimeout(() => {
      setInvitesSent(true)
      // Store that invites were sent and mark onboarding complete
      if (typeof window !== 'undefined') {
        localStorage.setItem('onboarding_invites_sent', JSON.stringify({
          teamMembers,
          sentAt: new Date().toISOString()
        }))
        localStorage.setItem('onboarding_complete', 'true')
        localStorage.setItem('onboarding_completed_at', new Date().toISOString())
      }

      // After showing success, continue to dashboard
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    }, 1500)
  }

  const handleSkip = () => {
    setIsLoading(true)
    // Mark onboarding complete even when skipping
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboarding_complete', 'true')
      localStorage.setItem('onboarding_completed_at', new Date().toISOString())
    }
    router.push('/dashboard')
  }

  const getRoleDescription = (role: TeamMember['role']) => {
    switch (role) {
      case 'scientist':
        return 'View all data, start dry-runs, request approvals'
      case 'developer':
        return 'Install agents, manage APIs, configure integrations'
      case 'manager':
        return 'Monitor usage, manage billing, full admin access'
      case 'compliance':
        return 'View audit logs, manage e-signatures, export records'
      default:
        return ''
    }
  }

  if (invitesSent) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="absolute top-0 left-0 right-0 flex justify-between items-center p-6">
          <div />
          <ThemeToggle />
        </header>

        {/* Success Message */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">
              Invites Sent!
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Your team will receive their invitations shortly.
            </p>
            <p className="text-xs text-muted-foreground">
              Redirecting to dashboard...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 flex justify-between items-center p-6">
        <button
          onClick={() => router.push('/onboarding/endpoints')}
          className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </button>
        <ThemeToggle />
      </header>

      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
        <div className="h-full w-full bg-foreground transition-all duration-300" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Step Indicator */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Step 5 of 5
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Invite Your Team
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Add team members to collaborate in your workspace
            </p>
          </div>

          {/* Invite Form */}
          <div className="space-y-6">
            {/* Email Input */}
            <div>
              <label htmlFor="email-input" className="block text-sm font-medium mb-2">
                Team Members
              </label>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">
                  Type email and press Enter, or upload a CSV file
                </p>
                <div className="relative">
                  <button
                    type="button"
                    onMouseEnter={() => setShowCsvHelp(true)}
                    onMouseLeave={() => setShowCsvHelp(false)}
                    className="p-1 rounded hover:bg-accent/50 transition-all"
                  >
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  {/* CSV Format Tooltip */}
                  {showCsvHelp && (
                    <div className="absolute z-50 bottom-full mb-2 right-0 p-3 bg-popover text-popover-foreground border rounded-md shadow-md w-64">
                      <p className="text-xs font-medium mb-2">CSV Format Guide</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        Include headers: <code>email,role</code>
                      </p>
                      <div className="text-xs bg-muted/50 p-2 rounded font-mono">
                        email,role<br/>
                        john@lab.com,scientist<br/>
                        sarah@lab.com,developer<br/>
                        mike@lab.com,manager
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        <strong>Accepted roles:</strong> scientist, developer, manager, compliance, admin, researcher, dev, it, qa
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Email Input Field */}
              <div className="flex gap-2 mb-3">
                <input
                  id="email-input"
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={handleAddEmail}
                  className="flex-1 px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                  placeholder="Enter email address..."
                />

                {/* CSV Upload Button */}
                <label className="px-4 py-2 rounded-md border border-border hover:bg-accent transition-colors cursor-pointer flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm">CSV</span>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleCsvUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Team Member Badges */}
              {teamMembers.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-md max-h-32 overflow-y-auto">
                  {teamMembers.map((member) => (
                    <div
                      key={member.email}
                      className="flex items-center gap-1 px-2 py-1 bg-background border border-border rounded-full text-xs"
                    >
                      <span>{member.email}</span>
                      <span className="text-[10px] text-muted-foreground px-1 border-l border-border">
                        {member.role}
                      </span>
                      <button
                        onClick={() => handleRemoveMember(member.email)}
                        className="p-0.5 hover:bg-accent rounded-full transition-colors"
                        type="button"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {teamMembers.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''} to invite
                </p>
              )}
            </div>

            {/* Default Role Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Default Role for New Invitees
              </label>
              <select
                value={defaultRole}
                onChange={(e) => setDefaultRole(e.target.value as TeamMember['role'])}
                className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
              >
                <option value="scientist">Scientist/Researcher</option>
                <option value="developer">Developer/IT</option>
                <option value="manager">Lab Manager</option>
                <option value="compliance">Compliance Officer</option>
              </select>

              {/* Permissions Preview */}
              <div className="mt-3 p-3 rounded-md bg-muted/50">
                <p className="text-xs font-medium mb-1">Permissions:</p>
                <p className="text-xs text-muted-foreground">
                  {getRoleDescription(defaultRole)}
                </p>
              </div>
            </div>

            {/* Info Note */}
            <div className="p-3 rounded-md bg-accent/50 border border-accent">
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    Invited users will receive an email with a secure link to join your workspace.
                    They&apos;ll create their own account and go through a simplified onboarding.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <div className="flex gap-3">
              <button
                onClick={handleSkip}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 rounded-md text-sm font-medium border border-border hover:bg-accent transition-colors disabled:opacity-50"
              >
                Skip for now
              </button>

              <button
                onClick={handleSendInvites}
                disabled={teamMembers.length === 0 || isLoading}
                className="flex-1 py-2.5 px-4 rounded-md text-sm font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Sending...' : (
                  <>
                    <UserPlus className="h-4 w-4 inline mr-2" />
                    {teamMembers.length > 0
                      ? `Send ${teamMembers.length} Invitation${teamMembers.length !== 1 ? 's' : ''}`
                      : 'Send Invitations'
                    }
                  </>
                )}
              </button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              You can always invite team members later from the dashboard
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}