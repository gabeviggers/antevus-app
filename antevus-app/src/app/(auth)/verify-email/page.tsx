'use client'

import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Mail, Sparkles } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Suspense } from 'react'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const email = searchParams.get('email') || 'your email'
  const isDemo = searchParams.get('demo') === 'true' || email === 'admin@antevus.com'

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="absolute top-0 right-0 p-6">
        <ThemeToggle />
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Card */}
          <div className="bg-card p-8 rounded-lg shadow-sm border">
            <div className="text-center">
              {/* Icon */}
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-muted">
                <Mail className="h-6 w-6 text-muted-foreground" />
              </div>

              {/* Title */}
              <h2 className="mt-4 text-2xl font-semibold">
                Check your email
              </h2>

              {/* Email */}
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a verification link to
              </p>
              <p className="text-sm font-medium">
                {email}
              </p>
            </div>

            <div className="mt-8 space-y-4">
              {isDemo ? (
                <>
                  {/* Demo Mode Info */}
                  <div className="bg-muted/50 border border-border rounded-md p-3">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        Demo Mode: Click below to instantly verify and proceed
                      </p>
                    </div>
                  </div>

                  {/* Instant Verify Button */}
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard')}
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
                  >
                    Instantly Verify & Continue →
                  </button>
                </>
              ) : (
                <>
                  {/* Info */}
                  <p className="text-xs text-center text-muted-foreground">
                    Click the link in the email to verify your account.
                    The link expires in 24 hours.
                  </p>

                  {/* Resend Button */}
                  <button
                    type="button"
                    className="w-full flex justify-center py-2 px-4 border rounded-md text-sm font-medium bg-card hover:bg-accent transition-colors"
                  >
                    Resend email
                  </button>
                </>
              )}

              {/* Back to login */}
              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Back to login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}