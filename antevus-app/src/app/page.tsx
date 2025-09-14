'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDemoCredentials, setShowDemoCredentials] = useState(false)

  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const result = await login({ email, password })

    if (result.success) {
      router.push('/dashboard')
    } else {
      setError(result.error || 'Login failed')
      setIsLoading(false)
    }
  }

  const fillDemoCredentials = (role: string) => {
    switch (role) {
      case 'admin':
        setEmail('admin@antevus.com')
        setPassword('admin123')
        break
      case 'scientist':
        setEmail('john.doe@lab.com')
        setPassword('scientist123')
        break
      case 'manager':
        setEmail('sarah.manager@lab.com')
        setPassword('manager123')
        break
      case 'viewer':
        setEmail('viewer@lab.com')
        setPassword('viewer123')
        break
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
              >
                <path d="M4.5 3h15" />
                <path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3" />
                <path d="M6 14h12" />
              </svg>
              <h1 className="text-4xl font-bold tracking-tight">Antevus</h1>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Universal Laboratory Instrument API Platform
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
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
                  disabled={isLoading}
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
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors pr-10"
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center">
                <input type="checkbox" className="mr-2 rounded border-input" />
                <span className="text-muted-foreground">Remember me</span>
              </label>
              <a href="#" className="text-foreground hover:text-muted-foreground transition-colors">
                Forgot password?
              </a>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Demo Credentials
                </span>
              </div>
            </div>

            {/* Demo Credentials Section */}
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground text-center">
                Click to auto-fill credentials for testing:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('admin')}
                  className="p-2 text-xs bg-accent hover:bg-accent/80 rounded-md transition-colors"
                >
                  <div className="font-medium">Admin</div>
                  <div className="text-muted-foreground">Full access</div>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('scientist')}
                  className="p-2 text-xs bg-accent hover:bg-accent/80 rounded-md transition-colors"
                >
                  <div className="font-medium">Scientist</div>
                  <div className="text-muted-foreground">Run instruments</div>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('manager')}
                  className="p-2 text-xs bg-accent hover:bg-accent/80 rounded-md transition-colors"
                >
                  <div className="font-medium">Lab Manager</div>
                  <div className="text-muted-foreground">Manage lab</div>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('viewer')}
                  className="p-2 text-xs bg-accent hover:bg-accent/80 rounded-md transition-colors"
                >
                  <div className="font-medium">Viewer</div>
                  <div className="text-muted-foreground">Read only</div>
                </button>
              </div>
            </div>
          </form>

          {/* Sign Up Link */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <a
                href="/signup"
                className="font-medium text-foreground hover:text-muted-foreground transition-colors"
              >
                Request a demo
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-muted-foreground">
        <div className="space-y-2">
          <p>&copy; 2024 Antevus. All rights reserved.</p>
          <div className="flex justify-center space-x-4">
            <a href="#" className="hover:text-foreground">Privacy Policy</a>
            <a href="#" className="hover:text-foreground">Terms of Service</a>
            <a href="#" className="hover:text-foreground">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  )
}