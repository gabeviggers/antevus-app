import { User } from './types'
import { UserRole } from '@/lib/security/authorization'

// Mock user database
// IMPORTANT: Using plaintext passwords for demo/dev only
// In production, passwords must be hashed server-side with bcrypt/argon2
export const mockUsers = [
  {
    id: 'usr_1',
    email: 'admin@antevus.com',
    password: 'admin123', // Dev-only: plaintext for demo builds
    name: 'Admin User',
    role: UserRole.ADMIN,
    organization: 'Antevus Labs',
    department: 'System Administration',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'usr_2',
    email: 'john.doe@lab.com',
    password: 'scientist123', // Dev-only: plaintext for demo builds
    name: 'John Doe',
    role: UserRole.SCIENTIST,
    organization: 'Research Lab Inc',
    department: 'Genomics',
    createdAt: '2024-01-15T00:00:00Z'
  },
  {
    id: 'usr_3',
    email: 'sarah.manager@lab.com',
    password: 'manager123', // Dev-only: plaintext for demo builds
    name: 'Sarah Johnson',
    role: UserRole.LAB_MANAGER,
    organization: 'Research Lab Inc',
    department: 'Operations',
    createdAt: '2024-01-10T00:00:00Z'
  },
  {
    id: 'usr_4',
    email: 'viewer@lab.com',
    password: 'viewer123', // Dev-only: plaintext for demo builds
    name: 'Viewer Account',
    role: UserRole.VIEWER,
    organization: 'Research Lab Inc',
    department: 'Quality Assurance',
    createdAt: '2024-02-01T00:00:00Z'
  }
]

export function validateCredentials(email: string, password: string): User | null {
  const user = mockUsers.find(u => u.email === email)
  if (!user) return null

  // Dev-only: plaintext comparison for demo builds
  // In production, use proper password hashing server-side
  if (user.password !== password) return null

  // Return user without password
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...userWithoutPassword } = user
  return userWithoutPassword as User
}