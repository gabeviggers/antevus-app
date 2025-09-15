import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Middleware for security headers and password protection
export function middleware(request: NextRequest) {
  // Add security headers to all responses
  const response = NextResponse.next()

  // Security headers for HIPAA and SOC 2 compliance
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  // X-XSS-Protection is obsolete in modern browsers, but kept for legacy support
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  // Content Security Policy - relaxed for development
  const isDevelopment = process.env.NODE_ENV === 'development'

  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "base-uri 'none'; object-src 'none'; form-action 'self'; " +
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}; ` +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    `connect-src 'self'${isDevelopment ? ' ws: wss:' : ''}; ` + // Allow WebSocket in dev
    "frame-ancestors 'none';"
  )

  // HSTS for production
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  // Cache control for sensitive pages
  if (request.nextUrl.pathname.startsWith('/dashboard') ||
      request.nextUrl.pathname.startsWith('/integrations') ||
      request.nextUrl.pathname.startsWith('/api')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  }

  // CSRF should be enforced where cookies are set (server routes) via SameSite+HttpOnly
  // and verified using CSRF tokens or double-submit. Remove this no-op block.
  // Skip protection for local development
  if (process.env.NODE_ENV === 'development') {
    return response
  }

  // Skip protection for API routes and static files
  if (
    request.nextUrl.pathname.startsWith('/api') ||
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/favicon.ico')
  ) {
    return response
  }

  // Check if already authenticated
  const authCookie = request.cookies.get('antevus-app-auth')
  const isProduction = process.env.VERCEL_ENV === 'production'

  // Require auth for production
  if (isProduction && authCookie?.value !== process.env.AUTH_PASSWORD) {
    // Check for password in query params
    const password = request.nextUrl.searchParams.get('password')

    if (password === process.env.AUTH_PASSWORD) {
      // Set auth cookie and redirect without password in URL
      const redirectResponse = NextResponse.redirect(
        new URL(request.nextUrl.pathname, request.url)
      )
      // Copy security headers to the redirect response
      for (const [key, value] of response.headers) {
        redirectResponse.headers.set(key, value)
      }
      redirectResponse.cookies.set('antevus-app-auth', password || '', {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 1 week
      })
      return redirectResponse
    }

    // Show password prompt page
    const promptResponse = new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Antevus App - Authentication Required</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
            }
            .container {
              background: white;
              border-radius: 12px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              padding: 40px;
              max-width: 400px;
              width: 100%;
            }
            h1 {
              color: #333;
              margin-bottom: 10px;
              font-size: 28px;
            }
            .subtitle {
              color: #666;
              margin-bottom: 30px;
              font-size: 14px;
            }
            .form-group {
              margin-bottom: 20px;
            }
            label {
              display: block;
              margin-bottom: 8px;
              color: #555;
              font-size: 14px;
              font-weight: 500;
            }
            input {
              width: 100%;
              padding: 12px;
              border: 2px solid #e1e1e1;
              border-radius: 8px;
              font-size: 16px;
              transition: border-color 0.3s;
            }
            input:focus {
              outline: none;
              border-color: #667eea;
            }
            button {
              width: 100%;
              padding: 14px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: transform 0.2s;
            }
            button:hover {
              transform: translateY(-2px);
            }
            .info {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #e1e1e1;
              color: #888;
              font-size: 12px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔬 Antevus Dashboard</h1>
            <p class="subtitle">B2B Laboratory Control Platform</p>
            <form method="GET">
              <div class="form-group">
                <label for="password">Enter Access Code</label>
                <input 
                  type="password" 
                  name="password" 
                  id="password" 
                  placeholder="Enter your access code"
                  autofocus
                  required
                />
              </div>
              <button type="submit">Access Dashboard</button>
            </form>
            <div class="info">
              This is a private B2B platform. Contact support@antevus.com for access.
            </div>
          </div>
        </body>
      </html>
      `,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    )
    // Apply security headers to the password prompt
    for (const [key, value] of response.headers) {
      promptResponse.headers.set(key, value)
    }
    return promptResponse
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}