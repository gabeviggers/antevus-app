export type UserRole = 'admin' | 'scientist' | 'lab_manager' | 'viewer'

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

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    'view_all_instruments',
    'control_instruments',
    'manage_users',
    'view_audit_logs',
    'manage_integrations',
    'export_data',
    'configure_system'
  ],
  lab_manager: [
    'view_all_instruments',
    'control_instruments',
    'view_audit_logs',
    'export_data',
    'manage_integrations'
  ],
  scientist: [
    'view_instruments',
    'control_assigned_instruments',
    'export_own_data',
    'view_own_runs'
  ],
  viewer: [
    'view_instruments',
    'view_own_runs'
  ]
}

export type Permission = string