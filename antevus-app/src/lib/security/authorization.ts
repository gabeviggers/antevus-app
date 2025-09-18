/**
 * Authorization Service for Access Control
 *
 * SECURITY NOTICE:
 * - Implements Role-Based Access Control (RBAC)
 * - Supports Attribute-Based Access Control (ABAC) for fine-grained permissions
 * - All authorization decisions are logged for audit
 * - Follows principle of least privilege
 * - Default deny for undefined permissions
 */

import { auditLogger, AuditEventType } from './audit-logger'

/**
 * User roles in the system
 */
export enum UserRole {
  // System roles
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',

  // Lab roles
  LAB_DIRECTOR = 'lab_director',
  LAB_MANAGER = 'lab_manager',
  SENIOR_SCIENTIST = 'senior_scientist',
  SCIENTIST = 'scientist',
  TECHNICIAN = 'technician',

  // Support roles
  QUALITY_ASSURANCE = 'quality_assurance',
  COMPLIANCE_OFFICER = 'compliance_officer',

  // External roles
  COLLABORATOR = 'collaborator',
  VIEWER = 'viewer',
  GUEST = 'guest'
}

/**
 * Resources that can be accessed
 */
export enum Resource {
  // Core features
  ASSISTANT = 'assistant',
  CHAT_HISTORY = 'chat_history',
  INSTRUMENTS = 'instruments',
  RUNS = 'runs',
  INTEGRATIONS = 'integrations',

  // Data operations
  DATA_EXPORT = 'data_export',
  DATA_IMPORT = 'data_import',
  DATA_DELETE = 'data_delete',

  // Admin features
  USER_MANAGEMENT = 'user_management',
  SYSTEM_CONFIG = 'system_config',
  AUDIT_LOGS = 'audit_logs',

  // Sensitive operations
  INSTRUMENT_CONTROL = 'instrument_control',
  PROTOCOL_EXECUTION = 'protocol_execution',
  PHI_ACCESS = 'phi_access'
}

/**
 * Actions that can be performed on resources
 */
export enum Action {
  // Read operations
  VIEW = 'view',
  LIST = 'list',
  SEARCH = 'search',

  // Write operations
  CREATE = 'create',
  EDIT = 'edit',
  DELETE = 'delete',

  // Special operations
  EXECUTE = 'execute',
  APPROVE = 'approve',
  EXPORT = 'export',
  SHARE = 'share',

  // Admin operations
  MANAGE = 'manage',
  CONFIGURE = 'configure',
  AUDIT = 'audit'
}

/**
 * Permission matrix defining what each role can do
 */
const PERMISSIONS: Record<UserRole, Set<`${Resource}:${Action}`>> = {
  [UserRole.SUPER_ADMIN]: new Set([
    // Full access to everything
    ...Object.values(Resource).flatMap(resource =>
      Object.values(Action).map(action => `${resource}:${action}` as `${Resource}:${Action}`)
    )
  ]),

  [UserRole.ADMIN]: new Set([
    // Assistant access
    'assistant:view',
    'assistant:execute',
    'chat_history:view',
    'chat_history:search',
    'chat_history:delete',

    // Full instrument access
    'instruments:view',
    'instruments:list',
    'instruments:create',
    'instruments:edit',
    'instruments:delete',
    'instruments:execute',

    // Data operations
    'data_export:execute',
    'data_import:execute',
    'data_delete:execute',

    // User management
    'user_management:view',
    'user_management:manage',

    // System config
    'system_config:view',
    'system_config:configure',

    // Audit logs
    'audit_logs:view',
    'audit_logs:search'
  ]),

  [UserRole.LAB_DIRECTOR]: new Set([
    // Assistant access
    'assistant:view',
    'assistant:execute',
    'chat_history:view',
    'chat_history:search',

    // Full instrument access
    'instruments:view',
    'instruments:list',
    'instruments:create',
    'instruments:edit',
    'instruments:execute',
    'instrument_control:execute',
    'protocol_execution:execute',
    'protocol_execution:approve',

    // Run management
    'runs:view',
    'runs:list',
    'runs:create',
    'runs:approve',

    // Data operations
    'data_export:execute',
    'data_import:execute',

    // PHI access
    'phi_access:view',

    // Integrations
    'integrations:view',
    'integrations:manage'
  ]),

  [UserRole.LAB_MANAGER]: new Set([
    // Assistant access
    'assistant:view',
    'assistant:execute',
    'chat_history:view',
    'chat_history:search',

    // Instrument management
    'instruments:view',
    'instruments:list',
    'instruments:edit',
    'instruments:execute',
    'protocol_execution:execute',

    // Run management
    'runs:view',
    'runs:list',
    'runs:create',

    // Data operations
    'data_export:execute',

    // Integrations
    'integrations:view',
    'integrations:configure'
  ]),

  [UserRole.SENIOR_SCIENTIST]: new Set([
    // Assistant access
    'assistant:view',
    'assistant:execute',
    'chat_history:view',
    'chat_history:search',

    // Instrument usage
    'instruments:view',
    'instruments:list',
    'instruments:execute',
    'protocol_execution:execute',

    // Run management
    'runs:view',
    'runs:list',
    'runs:create',
    'runs:edit',

    // Data operations
    'data_export:execute',

    // Limited PHI access
    'phi_access:view'
  ]),

  [UserRole.SCIENTIST]: new Set([
    // Assistant access
    'assistant:view',
    'assistant:execute',
    'chat_history:view',

    // Instrument usage
    'instruments:view',
    'instruments:list',
    'instruments:execute',

    // Run management
    'runs:view',
    'runs:list',
    'runs:create',

    // Data export
    'data_export:execute'
  ]),

  [UserRole.TECHNICIAN]: new Set([
    // Full assistant access for technicians
    'assistant:view',
    'assistant:execute',
    'chat_history:view',
    'chat_history:search',

    // Instrument viewing
    'instruments:view',
    'instruments:list',

    // Run viewing
    'runs:view',
    'runs:list'
  ]),

  [UserRole.QUALITY_ASSURANCE]: new Set([
    // Assistant for QA purposes
    'assistant:view',
    'assistant:execute',
    'chat_history:view',
    'chat_history:search',

    // Read-only access to most things
    'instruments:view',
    'instruments:list',
    'runs:view',
    'runs:list',
    'runs:search',

    // Audit capabilities
    'audit_logs:view',
    'audit_logs:search',

    // Data export for reports
    'data_export:execute'
  ]),

  [UserRole.COMPLIANCE_OFFICER]: new Set([
    // Assistant for compliance checks
    'assistant:view',
    'assistant:execute',
    'chat_history:view',
    'chat_history:search',

    // Audit focus
    'audit_logs:view',
    'audit_logs:search',
    'audit_logs:audit',

    // PHI access for compliance
    'phi_access:view',
    'phi_access:audit',

    // System config viewing
    'system_config:view'
  ]),

  [UserRole.COLLABORATOR]: new Set([
    // Full assistant access for collaborators
    'assistant:view',
    'assistant:execute',
    'chat_history:view',

    // View shared data
    'instruments:view',
    'runs:view',

    // Export shared data
    'data_export:execute'
  ]),

  [UserRole.VIEWER]: new Set([
    // Read-only access - NO assistant access
    'instruments:view',
    'instruments:list',
    'runs:view',
    'runs:list'
  ]),

  [UserRole.GUEST]: new Set([
    // Minimal access - NO assistant access
    'instruments:list',
    'runs:list'
  ])
}

/**
 * User context for authorization
 */
export interface UserContext {
  id: string
  email: string
  roles: UserRole[]
  attributes?: Record<string, unknown>
  sessionId?: string
}

/**
 * Authorization request
 */
export interface AuthorizationRequest {
  user: UserContext
  resource: Resource | string
  action: Action | string
  context?: Record<string, unknown>
}

/**
 * Authorization result
 */
export interface AuthorizationResult {
  allowed: boolean
  reason?: string
  requiredRole?: UserRole
  missingPermission?: string
}

/**
 * Authorization Service
 */
class AuthorizationService {
  private cache: Map<string, { result: AuthorizationResult; timestamp: number }> = new Map()
  private readonly CACHE_TTL = 60000 // 1 minute

  /**
   * Check if a user can perform an action on a resource
   */
  async can(request: AuthorizationRequest): Promise<AuthorizationResult> {
    const startTime = Date.now()
    const cacheKey = this.getCacheKey(request)

    // Check cache
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result
    }

    // Perform authorization check
    const result = this.performAuthorizationCheck(request)

    // Cache the result
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    })

    // Audit log the authorization decision
    auditLogger.log({
      eventType: result.allowed
        ? AuditEventType.DATA_ACCESS_GRANTED
        : AuditEventType.DATA_ACCESS_DENIED,
      action: `Authorization ${result.allowed ? 'granted' : 'denied'}`,
      userId: request.user.id,
      resourceType: String(request.resource),
      metadata: {
        resource: request.resource,
        action: request.action,
        roles: request.user.roles,
        reason: result.reason,
        duration: Date.now() - startTime
      },
      outcome: result.allowed ? 'SUCCESS' : 'FAILURE'
    })

    return result
  }

  /**
   * Perform the actual authorization check
   */
  private performAuthorizationCheck(request: AuthorizationRequest): AuthorizationResult {
    const { user, resource, action } = request

    // Super admin bypass
    if (user.roles.includes(UserRole.SUPER_ADMIN)) {
      return { allowed: true, reason: 'Super admin access' }
    }

    // Check if user has any role with the required permission
    const permission = `${resource}:${action}` as `${Resource}:${Action}`

    for (const role of user.roles) {
      const rolePermissions = PERMISSIONS[role]
      if (rolePermissions?.has(permission)) {
        return {
          allowed: true,
          reason: `Permission granted via ${role} role`
        }
      }
    }

    // Check for attribute-based access (ABAC)
    const abacResult = this.checkAttributeBasedAccess(request)
    if (abacResult.allowed) {
      return abacResult
    }

    // Find what role would grant this permission
    const requiredRole = this.findRequiredRole(permission)

    return {
      allowed: false,
      reason: 'Insufficient permissions',
      requiredRole,
      missingPermission: permission
    }
  }

  /**
   * Check attribute-based access control
   */
  private checkAttributeBasedAccess(request: AuthorizationRequest): AuthorizationResult {
    const { user, resource, action, context } = request

    // Example: Users can always view their own chat history
    if (resource === Resource.CHAT_HISTORY && action === Action.VIEW) {
      if (context?.userId === user.id) {
        return {
          allowed: true,
          reason: 'User accessing own chat history'
        }
      }
    }

    // Example: Department-based access
    if (user.attributes?.department && context?.department) {
      if (user.attributes.department === context.department) {
        // Allow viewing within same department
        if (action === Action.VIEW) {
          return {
            allowed: true,
            reason: 'Same department access'
          }
        }
      }
    }

    // Example: Time-based access
    if (context?.timeRestricted) {
      const now = new Date()
      const hour = now.getHours()
      if (hour < 8 || hour > 18) {
        return {
          allowed: false,
          reason: 'Access restricted outside business hours'
        }
      }
    }

    return { allowed: false }
  }

  /**
   * Find which role would grant a permission
   */
  private findRequiredRole(permission: `${Resource}:${Action}`): UserRole | undefined {
    for (const [role, permissions] of Object.entries(PERMISSIONS)) {
      if (permissions.has(permission)) {
        return role as UserRole
      }
    }
    return undefined
  }

  /**
   * Generate cache key for authorization request
   */
  private getCacheKey(request: AuthorizationRequest): string {
    return `${request.user.id}:${request.resource}:${request.action}:${JSON.stringify(request.context || {})}`
  }

  /**
   * Clear authorization cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Check multiple permissions at once
   */
  async canAll(
    user: UserContext,
    checks: Array<{ resource: Resource | string; action: Action | string }>
  ): Promise<boolean> {
    const results = await Promise.all(
      checks.map(check => this.can({ user, ...check }))
    )
    return results.every(result => result.allowed)
  }

  /**
   * Check if user has any of the permissions
   */
  async canAny(
    user: UserContext,
    checks: Array<{ resource: Resource | string; action: Action | string }>
  ): Promise<boolean> {
    const results = await Promise.all(
      checks.map(check => this.can({ user, ...check }))
    )
    return results.some(result => result.allowed)
  }

  /**
   * Get all permissions for a user
   */
  getUserPermissions(user: UserContext): Set<string> {
    const allPermissions = new Set<string>()

    for (const role of user.roles) {
      const rolePermissions = PERMISSIONS[role]
      if (rolePermissions) {
        rolePermissions.forEach(permission => allPermissions.add(permission))
      }
    }

    return allPermissions
  }
}

// Export singleton instance
export const authorizationService = new AuthorizationService()

// Export for type usage
export default AuthorizationService