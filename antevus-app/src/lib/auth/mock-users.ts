import { createHash } from 'crypto'
import { User } from './types'

// Mock user database
// In production, this would be stored in a secure database with hashed passwords
export const mockUsers = [
  {
    id: 'usr_1',
    email: 'admin@antevus.com',
    password: hashPassword('admin123'), // In production, use bcrypt
    name: 'Admin User',
    role: 'admin' as const,
    organization: 'Antevus Labs',
    department: 'System Administration',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'usr_2',
    email: 'john.doe@lab.com',
    password: hashPassword('scientist123'),
    name: 'John Doe',
    role: 'scientist' as const,
    organization: 'Research Lab Inc',
    department: 'Genomics',
    createdAt: '2024-01-15T00:00:00Z'
  },
  {
    id: 'usr_3',
    email: 'sarah.manager@lab.com',
    password: hashPassword('manager123'),
    name: 'Sarah Johnson',
    role: 'lab_manager' as const,
    organization: 'Research Lab Inc',
    department: 'Operations',
    createdAt: '2024-01-10T00:00:00Z'
  },
  {
    id: 'usr_4',
    email: 'viewer@lab.com',
    password: hashPassword('viewer123'),
    name: 'Viewer Account',
    role: 'viewer' as const,
    organization: 'Research Lab Inc',
    department: 'Quality Assurance',
    createdAt: '2024-02-01T00:00:00Z'
  }
]

// Simple hash function for demo purposes
// In production, use bcrypt or argon2
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

export function validateCredentials(email: string, password: string): User | null {
  const user = mockUsers.find(u => u.email === email)
  if (!user) return null

  const hashedInput = hashPassword(password)
  if (user.password !== hashedInput) return null

  // Return user without password
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...userWithoutPassword } = user
  return userWithoutPassword as User
}