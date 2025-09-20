/**
 * Server-side code example generation
 * Generates code examples with masked API keys
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthenticatedSession } from '@/lib/security/auth-wrapper'
import { logger } from '@/lib/logger'

// Force Node.js runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface CodeExampleRequest {
  endpoint: {
    method: string
    path: string
    params?: {
      body?: unknown
      query?: unknown
      path?: unknown
    }
  }
  language: 'python' | 'javascript' | 'curl'
}

async function handlePOST(request: NextRequest, session: AuthenticatedSession) {
  try {

    const body: CodeExampleRequest = await request.json()
    const { endpoint, language } = body

    if (!endpoint || !language) {
      return NextResponse.json(
        { error: 'Endpoint and language required' },
        { status: 400 }
      )
    }

    // Generate code example with masked API key
    const codeExample = generateSecureCodeExample(endpoint, language)

    return NextResponse.json({ code: codeExample })

  } catch (error) {
    logger.error('Code example generation failed', error)
    return NextResponse.json(
      { error: 'Failed to generate code example' },
      { status: 500 }
    )
  }
}

// Export wrapped handlers (GET only for this endpoint)
// Export with CSRF protection
import { protectWithCSRF } from '@/lib/security/csrf-middleware'

export const { POST } = protectWithCSRF({
  POST: withAuth(handlePOST)
})

function generateSecureCodeExample(
  endpoint: CodeExampleRequest['endpoint'],
  language: CodeExampleRequest['language']
): string {
  const baseUrl = 'https://api.antevus.com'
  const fullPath = `${baseUrl}${endpoint.path}`
  // Always use a placeholder - never expose real keys
  const maskedKey = 'ak_live_YOUR_API_KEY_HERE'

  switch (language) {
    case 'python':
      return `import requests

headers = {
    'Authorization': f'Bearer ${maskedKey}',
    'Content-Type': 'application/json'
}

response = requests.${endpoint.method.toLowerCase()}(
    '${fullPath}',
    headers=headers${endpoint.params?.body ? `,
    json=${JSON.stringify(endpoint.params.body, null, 4).split('\n').join('\n    ')}` : ''}
)

print(response.json())`

    case 'javascript':
      return `const response = await fetch('${fullPath}', {
  method: '${endpoint.method}',
  headers: {
    'Authorization': 'Bearer ${maskedKey}',
    'Content-Type': 'application/json'
  }${endpoint.params?.body ? `,
  body: JSON.stringify(${JSON.stringify(endpoint.params.body, null, 2).split('\n').join('\n  ')})` : ''}
})

const data = await response.json()
console.log(data)`

    case 'curl':
      return `curl -X ${endpoint.method} '${fullPath}' \\
  -H 'Authorization: Bearer ${maskedKey}' \\
  -H 'Content-Type: application/json'${endpoint.params?.body ? ` \\
  -d '${JSON.stringify(endpoint.params.body)}'` : ''}`

    default:
      return '// Unsupported language'
  }
}