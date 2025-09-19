'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'

// Password strength requirements
const PASSWORD_REQUIREMENTS = {
  minLength: { check: (p: string) => p.length >= 12, label: '12+ characters' },
  uppercase: { check: (p: string) => /[A-Z]/.test(p), label: 'Uppercase letter' },
  lowercase: { check: (p: string) => /[a-z]/.test(p), label: 'Lowercase letter' },
  number: { check: (p: string) => /\d/.test(p), label: 'Number' },
  special: { check: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p), label: 'Special character' }
}

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [passwordFocused, setPasswordFocused] = useState(false)
  const router = useRouter()

  // Calculate password strength
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, percentage: 0, color: '', label: '' }

    let score = 0
    Object.values(PASSWORD_REQUIREMENTS).forEach(req => {
      if (req.check(password)) score++
    })

    const percentage = (score / Object.keys(PASSWORD_REQUIREMENTS).length) * 100

    let color = ''
    let label = ''

    if (percentage === 0) {
      color = ''
      label = ''
    } else if (percentage <= 40) {
      color = 'bg-red-500'
      label = 'Weak'
    } else if (percentage <= 60) {
      color = 'bg-orange-500'
      label = 'Fair'
    } else if (percentage <= 80) {
      color = 'bg-yellow-500'
      label = 'Good'
    } else {
      color = 'bg-green-500'
      label = 'Strong'
    }

    return { score, percentage, color, label }
  }, [password])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Demo mode bypass for admin@antevus.com
    const isDemo = email === 'admin@antevus.com'

    // Basic validation (skip for demo)
    if (!isDemo && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Check if all password requirements are met (skip for demo)
    if (!isDemo && passwordStrength.percentage < 100) {
      setError('Password must meet all security requirements')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed')
      }

      // TODO: Implement secure token storage (httpOnly cookies via API)
      // NEVER store tokens in localStorage - HIPAA violation
      logger.info('Signup successful', { email })

      // Check if demo mode response
      const isDemo = data.isDemo || email === 'admin@antevus.com'

      // Redirect to email verification page with demo flag if applicable
      const queryParams = new URLSearchParams({ email })
      if (isDemo) queryParams.append('demo', 'true')
      router.push(`/verify-email?${queryParams.toString()}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
      setIsLoading(false)
    }
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
          {/* Logo and Title */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-3">
              {/* Beaker SVG Icon */}
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-600 dark:text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M4.5 3h15" />
                <path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3" />
                <path d="M6 14h12" />
              </svg>
              <h1 className="text-4xl font-bold tracking-tight">
                Antevus
              </h1>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your workspace
            </p>
          </div>

          {/* Signup Form */}
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                  placeholder="you@laboratory.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    className="w-full px-3 py-2 pr-10 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Password Strength Progress Bar */}
                {password && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Password strength</span>
                      {passwordStrength.label && (
                        <span className={cn(
                          "text-xs font-medium",
                          passwordStrength.percentage === 100 ? "text-green-600 dark:text-green-500" :
                          passwordStrength.percentage >= 80 ? "text-yellow-600 dark:text-yellow-500" :
                          passwordStrength.percentage >= 60 ? "text-orange-600 dark:text-orange-500" :
                          "text-red-600 dark:text-red-500"
                        )}>
                          {passwordStrength.label}
                        </span>
                      )}
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-300 ease-out",
                          passwordStrength.color
                        )}
                        style={{ width: `${passwordStrength.percentage}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Requirements Checklist - Only show when focused or requirements not met */}
                {(passwordFocused || (password && passwordStrength.percentage < 100)) && (
                  <div className="mt-3 space-y-1">
                    {Object.entries(PASSWORD_REQUIREMENTS).map(([key, req]) => {
                      const isMet = password ? req.check(password) : false
                      return (
                        <div
                          key={key}
                          className={cn(
                            "flex items-center gap-2 text-xs transition-colors",
                            isMet ? "text-green-600 dark:text-green-500" : "text-muted-foreground"
                          )}
                        >
                          {isMet ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                          <span>{req.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !email || (email !== 'admin@antevus.com' && (passwordStrength.percentage < 100 || password !== confirmPassword))}
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or sign up with
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => logger.info('Google OAuth signup')}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => logger.info('GitHub OAuth signup')}
              >
                <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub
              </Button>
            </div>

            {/* Mobile only: Sign In Link and Copyright */}
            <div className="sm:hidden space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="font-medium text-foreground hover:text-muted-foreground transition-colors"
                >
                  Sign in
                </Link>
              </p>
              <p className="text-xs text-muted-foreground">
                &copy; 2025 Antevus. All rights reserved.
              </p>
            </div>
          </form>

          {/* Desktop only: Sign In Link */}
          <div className="hidden sm:block text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-medium text-foreground hover:text-muted-foreground transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Desktop only: Footer in bottom left */}
      <footer className="hidden sm:block absolute bottom-0 left-0 p-6">
        <p className="text-xs text-muted-foreground">
          &copy; 2025 Antevus. All rights reserved.
        </p>
      </footer>
    </div>
  )
}