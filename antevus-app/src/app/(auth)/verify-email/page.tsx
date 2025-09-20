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
  // No client-side demo detection - handle on server

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

              {/* CEO/Founder Demo Skip - ONLY for admin@antevus.com in development */}
              {process.env.NODE_ENV === 'development' && email === 'admin@antevus.com' && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Demo Mode (CEO Access)
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => router.push('/onboarding/role')}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Sparkles className="h-4 w-4" />
                    Skip Verification (Demo)
                  </button>

                  <p className="text-xs text-center text-muted-foreground">
                    This option is only available for the founder account in development mode
                  </p>
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