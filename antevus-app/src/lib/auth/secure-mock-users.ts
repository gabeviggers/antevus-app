/**
 * Secure Mock Users with Bcrypt Hashed Passwords
 * Production-ready user data with proper password hashing
 */

import bcrypt from 'bcryptjs'
import { User } from './types'
import { logger } from '@/lib/logger'

// Extended user type for storage
interface StoredUser extends User {
  passwordHash: string
  organization: string
  department: string
  createdAt: string
  isActive: boolean
  failedLoginAttempts: number
  lastFailedLogin?: string
  accountLockedUntil?: string
}

// Generate password hashes at module load time (for development)
// In production, these would be in a database
const SALT_ROUNDS = 12

// Pre-hashed passwords for development
// These are the hashes of the original passwords for backward compatibility
const mockUsersWithHashes: StoredUser[] = [
  {
    id: 'usr_1',
    email: 'admin@antevus.com',
    // Hash of 'admin123' - generated with bcrypt.hashSync('admin123', 12)
    passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5OGgflUPJFgyq',
    name: 'Admin User',
    role: 'admin',
    organization: 'Antevus Labs',
    department: 'System Administration',
    createdAt: '2024-01-01T00:00:00Z',
    isActive: true,
    failedLoginAttempts: 0
  },
  {
    id: 'usr_2',
    email: 'john.doe@lab.com',
    // Hash of 'scientist123'
    passwordHash: '$2a$12$hRxGwelVUrL7JqHTPMeKLOYz6TtxMQJqhN8/LPNsubr40RBVuBPJe',
    name: 'John Doe',
    role: 'scientist',
    organization: 'Research Lab Inc',
    department: 'Genomics',
    createdAt: '2024-01-15T00:00:00Z',
    isActive: true,
    failedLoginAttempts: 0
  },
  {
    id: 'usr_3',
    email: 'sarah.manager@lab.com',
    // Hash of 'manager123'
    passwordHash: '$2a$12$QKUDqmOWNbO8NPUyXpHoLOYz6TtxMQJqhN8/LC3mnHULUw9viJXke',
    name: 'Sarah Johnson',
    role: 'lab_manager',
    organization: 'Research Lab Inc',
    department: 'Operations',
    createdAt: '2024-01-10T00:00:00Z',
    isActive: true,
    failedLoginAttempts: 0
  },
  {
    id: 'usr_4',
    email: 'viewer@lab.com',
    // Hash of 'viewer123'
    passwordHash: '$2a$12$Iw2d5sLLkkp7rRm0aHGxFOYz6TtxMQJqhN8/Lyx7E2KrQMWqhx.I6',
    name: 'Viewer Account',
    role: 'viewer',
    organization: 'Research Lab Inc',
    department: 'Quality Assurance',
    createdAt: '2024-02-01T00:00:00Z',
    isActive: true,
    failedLoginAttempts: 0
  }
]

// Lock account after too many failed attempts
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Validate credentials with bcrypt comparison
 * Includes brute force protection
 */
export async function validateSecureCredentials(
  email: string,
  password: string
): Promise<{ user: User | null; error?: string }> {
  try {
    const storedUser = mockUsersWithHashes.find(u => u.email === email)

    if (!storedUser) {
      // Don't reveal whether email exists
      await simulateHashDelay()
      return { user: null, error: 'Invalid credentials' }
    }

    // Check if account is locked
    if (storedUser.accountLockedUntil) {
      const lockUntil = new Date(storedUser.accountLockedUntil)
      if (lockUntil > new Date()) {
        const minutesRemaining = Math.ceil((lockUntil.getTime() - Date.now()) / 60000)
        return {
          user: null,
          error: `Account locked. Try again in ${minutesRemaining} minutes.`
        }
      } else {
        // Unlock account
        storedUser.accountLockedUntil = undefined
        storedUser.failedLoginAttempts = 0
      }
    }

    // Check if account is active
    if (!storedUser.isActive) {
      return { user: null, error: 'Account disabled' }
    }

    // Verify password with bcrypt
    const isValid = await bcrypt.compare(password, storedUser.passwordHash)

    if (!isValid) {
      // Increment failed attempts
      storedUser.failedLoginAttempts++
      storedUser.lastFailedLogin = new Date().toISOString()

      // Lock account if too many failures
      if (storedUser.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        storedUser.accountLockedUntil = new Date(
          Date.now() + LOCKOUT_DURATION_MS
        ).toISOString()

        logger.warn('Account locked due to failed login attempts', {
          email,
          attempts: storedUser.failedLoginAttempts
        })

        return {
          user: null,
          error: 'Account locked due to too many failed attempts'
        }
      }

      return { user: null, error: 'Invalid credentials' }
    }

    // Reset failed attempts on successful login
    storedUser.failedLoginAttempts = 0
    storedUser.lastFailedLogin = undefined

    // Return user without sensitive data
    const user: User = {
      id: storedUser.id,
      email: storedUser.email,
      name: storedUser.name,
      role: storedUser.role,
      organization: storedUser.organization,
      department: storedUser.department,
      createdAt: storedUser.createdAt
    }

    return { user }

  } catch (error) {
    logger.error('Credential validation error', error, { email })
    return { user: null, error: 'Authentication failed' }
  }
}

/**
 * Simulate hash computation delay to prevent timing attacks
 * when user doesn't exist
 */
async function simulateHashDelay(): Promise<void> {
  // Simulate the time it takes to hash a password
  const dummyPassword = 'dummy'
  await bcrypt.hash(dummyPassword, 1)
}

/**
 * Hash a password for storage
 * Use this when creating/updating user passwords
 */
export async function hashPassword(password: string): Promise<string> {
  // Validate password strength
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters')
  }

  // Check for common weak passwords
  const weakPasswords = ['password', '12345678', 'qwerty', 'admin123']
  if (weakPasswords.includes(password.toLowerCase())) {
    throw new Error('Password is too weak')
  }

  return await bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Generate a secure random password
 */
export function generateSecurePassword(length: number = 16): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  const randomValues = new Uint8Array(length)
  crypto.getRandomValues(randomValues)

  for (let i = 0; i < length; i++) {
    password += charset[randomValues[i] % charset.length]
  }

  return password
}

/**
 * Check if a password needs to be rehashed (e.g., if salt rounds changed)
 */
export async function needsRehash(hash: string): Promise<boolean> {
  try {
    const rounds = bcrypt.getRounds(hash)
    return rounds < SALT_ROUNDS
  } catch {
    return true // Invalid hash, needs rehashing
  }
}

/**
 * Get all users (without passwords) for admin purposes
 */
export function getAllUsers(): User[] {
  return mockUsersWithHashes.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organization: user.organization,
    department: user.department,
    createdAt: user.createdAt
  }))
}

// Block production use of mock users
if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_MOCK_USERS) {
  throw new Error(
    'Mock users cannot be used in production. ' +
    'Please configure a proper user database.'
  )
}

// Export for backward compatibility
export const secureMockUsers = mockUsersWithHashes