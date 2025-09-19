'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'

type UserRole = 'admin' | 'developer' | 'scientist'

interface RoleOption {
  id: UserRole
  emoji: string
  title: string
  description: string
}

const roleOptions: RoleOption[] = [
  {
    id: 'admin',
    emoji: '👤',
    title: 'Admin/Manager',
    description: 'Manage billing, invite team, monitor usage'
  },
  {
    id: 'developer',
    emoji: '⚙️',
    title: 'Developer',
    description: 'Install agents, manage APIs, set up integrations'
  },
  {
    id: 'scientist',
    emoji: '🧪',
    title: 'Scientist',
    description: 'Run experiments, analyze data, view results'
  }
]

export default function RoleSelectionPage() {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleContinue = async () => {
    if (!selectedRole) return

    setIsLoading(true)

    // Save role to user profile (would call API in production)
    // For now, just store in localStorage for the onboarding flow
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboarding_role', selectedRole)
    }

    // Navigate to profile setup
    router.push('/onboarding/profile')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="absolute top-0 right-0 p-6">
        <ThemeToggle />
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold">
              Welcome to Antevus!
            </h1>
            <p className="text-sm text-muted-foreground">
              Tell us who you are
            </p>
            <p className="text-xs text-muted-foreground">
              This helps us customize your experience
            </p>
          </div>

          {/* Role Options - Clean radio style */}
          <div className="space-y-2">
            {roleOptions.map((role) => (
              <label
                key={role.id}
                className="flex items-start p-4 rounded-md border border-border bg-card cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <input
                  type="radio"
                  name="role"
                  value={role.id}
                  checked={selectedRole === role.id}
                  onChange={() => setSelectedRole(role.id)}
                  className="sr-only"
                />
                <div className="flex items-start w-full">
                  <span className="text-xl mr-3">{role.emoji}</span>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{role.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {role.description}
                    </div>
                  </div>
                  <div className="ml-3 mt-1">
                    <div className={`w-4 h-4 rounded-full border-2 transition-colors ${
                      selectedRole === role.id
                        ? 'border-foreground bg-foreground'
                        : 'border-muted-foreground'
                    }`}>
                      {selectedRole === role.id && (
                        <div className="w-full h-full rounded-full flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-background" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            disabled={!selectedRole || isLoading}
            className="w-full py-2.5 px-4 rounded-md text-sm font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Setting up...' : 'Continue →'}
          </button>

          {/* Free Trial Notice - Subtle */}
          <p className="text-center text-xs text-muted-foreground">
            30-day free trial • No credit card required
          </p>
        </div>
      </div>
    </div>
  )
}