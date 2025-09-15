import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { validateCredentials } from '@/lib/auth/mock-users'
import { AuthSession } from '@/lib/auth/types'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Validate credentials against mock database
    const user = validateCredentials(email, password)

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Create secure session with cryptographically secure token
    const secureToken = randomBytes(32).toString('hex')

    const session: AuthSession = {
      user: {
        ...user,
        lastLogin: new Date().toISOString()
      },
      token: secureToken, // Cryptographically secure token
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    }

    return NextResponse.json({
      success: true,
      session
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, error: 'An error occurred during login' },
      { status: 500 }
    )
  }
}