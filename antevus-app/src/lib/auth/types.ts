import { UserRole } from '@/lib/security/authorization'
export { UserRole }

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  organization: string
  department?: string
  lastLogin?: string
  createdAt: string
}

export interface AuthSession {
  user: User
  token: string
  expiresAt: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthResponse {
  success: boolean
  session?: AuthSession
  error?: string
}

export const ROLE_PERMISSIONS: Partial<Record<UserRole, string[]>> = {
  [UserRole.ADMIN]: [
    'view_all_instruments',
    'control_instruments',
    'manage_users',
    'view_audit_logs',
    'manage_integrations',
    'export_data',
    'configure_system'
  ],
  [UserRole.LAB_MANAGER]: [
    'view_all_instruments',
    'control_instruments',
    'view_audit_logs',
    'export_data',
    'manage_integrations'
  ],
  [UserRole.SCIENTIST]: [
    'view_instruments',
    'control_assigned_instruments',
    'export_own_data',
    'view_own_runs'
  ],
  [UserRole.VIEWER]: [
    'view_instruments',
    'view_own_runs'
  ]
}

export type Permission = string