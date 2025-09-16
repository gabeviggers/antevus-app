/**
 * Fine-Grained Authorization Service
 * Implements both RBAC (Role-Based) and ABAC (Attribute-Based) Access Control
 * Compliant with principle of least privilege for HIPAA/SOC 2
 */

import { User } from './types'
import { logger } from '@/lib/logger'
import { tamperEvidentAuditLogger } from '@/lib/audit/tamper-evident-logger'

// Permission types
export type Action = 'create' | 'read' | 'update' | 'delete' | 'execute' | 'approve' | 'audit'
export type Resource =
  | 'instrument'
  | 'run'
  | 'data'
  | 'user'
  | 'api_key'
  | 'audit_log'
  | 'integration'
  | 'report'
  | 'settings'
  | 'billing'

// Condition operators for ABAC
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'in'
  | 'not_in'
  | 'greater_than'
  | 'less_than'
  | 'matches_regex'

// Type for condition values
export type ConditionValue = string | number | boolean | null | string[]

export interface Condition {
  field: string
  operator: ConditionOperator
  value: ConditionValue
}

export interface Permission {
  resource: Resource
  actions: Action[]
  conditions?: Condition[] // ABAC conditions
  scope?: 'own' | 'department' | 'organization' | 'all' // Data scope
}

export interface Role {
  name: string
  description: string
  permissions: Permission[]
  inherits?: string[] // Role inheritance
}

// Define comprehensive role permissions
export const ROLES: Record<string, Role> = {
  admin: {
    name: 'Administrator',
    description: 'Full system access',
    permissions: [
      {
        resource: 'instrument',
        actions: ['create', 'read', 'update', 'delete', 'execute'],
        scope: 'all'
      },
      {
        resource: 'run',
        actions: ['create', 'read', 'update', 'delete', 'approve'],
        scope: 'all'
      },
      {
        resource: 'data',
        actions: ['read', 'update', 'delete'],
        scope: 'all'
      },
      {
        resource: 'user',
        actions: ['create', 'read', 'update', 'delete'],
        scope: 'all'
      },
      {
        resource: 'api_key',
        actions: ['create', 'read', 'update', 'delete'],
        scope: 'all'
      },
      {
        resource: 'audit_log',
        actions: ['read', 'audit'],
        scope: 'all'
      },
      {
        resource: 'settings',
        actions: ['read', 'update'],
        scope: 'all'
      },
      {
        resource: 'billing',
        actions: ['read', 'update'],
        scope: 'all'
      }
    ]
  },

  scientist: {
    name: 'Scientist',
    description: 'Can run experiments and view data',
    permissions: [
      {
        resource: 'instrument',
        actions: ['read', 'execute'],
        scope: 'department'
      },
      {
        resource: 'run',
        actions: ['create', 'read', 'update'],
        scope: 'own',
        conditions: [
          {
            field: 'status',
            operator: 'not_equals',
            value: 'approved'
          }
        ]
      },
      {
        resource: 'data',
        actions: ['read'],
        scope: 'department'
      },
      {
        resource: 'api_key',
        actions: ['create', 'read', 'delete'],
        scope: 'own'
      },
      {
        resource: 'report',
        actions: ['create', 'read'],
        scope: 'own'
      }
    ]
  },

  lab_manager: {
    name: 'Lab Manager',
    description: 'Can manage lab resources and approve runs',
    permissions: [
      {
        resource: 'instrument',
        actions: ['read', 'update', 'execute'],
        scope: 'department'
      },
      {
        resource: 'run',
        actions: ['read', 'update', 'approve'],
        scope: 'department'
      },
      {
        resource: 'data',
        actions: ['read', 'update'],
        scope: 'department'
      },
      {
        resource: 'user',
        actions: ['read'],
        scope: 'department'
      },
      {
        resource: 'report',
        actions: ['create', 'read', 'update'],
        scope: 'department'
      },
      {
        resource: 'audit_log',
        actions: ['read'],
        scope: 'department'
      }
    ],
    inherits: ['scientist'] // Inherits scientist permissions
  },

  viewer: {
    name: 'Viewer',
    description: 'Read-only access',
    permissions: [
      {
        resource: 'instrument',
        actions: ['read'],
        scope: 'department'
      },
      {
        resource: 'run',
        actions: ['read'],
        scope: 'department'
      },
      {
        resource: 'data',
        actions: ['read'],
        scope: 'department',
        conditions: [
          {
            field: 'classification',
            operator: 'not_equals',
            value: 'confidential'
          }
        ]
      },
      {
        resource: 'report',
        actions: ['read'],
        scope: 'department'
      }
    ]
  },

  compliance_officer: {
    name: 'Compliance Officer',
    description: 'Audit and compliance access',
    permissions: [
      {
        resource: 'audit_log',
        actions: ['read', 'audit'],
        scope: 'all'
      },
      {
        resource: 'user',
        actions: ['read'],
        scope: 'all'
      },
      {
        resource: 'data',
        actions: ['read'],
        scope: 'all',
        conditions: [
          {
            field: 'purpose',
            operator: 'equals',
            value: 'audit'
          }
        ]
      },
      {
        resource: 'report',
        actions: ['read', 'create'],
        scope: 'all',
        conditions: [
          {
            field: 'type',
            operator: 'in',
            value: ['compliance', 'audit', 'security']
          }
        ]
      }
    ]
  }
}

// Context for ABAC evaluation
export interface AuthorizationContext {
  user: User
  resource: Resource
  action: Action
  resourceData?: Record<string, unknown> // Actual resource being accessed
  environment?: {
    ipAddress?: string
    time?: Date
    location?: string
    deviceTrust?: boolean
  }
}

/**
 * Authorization Service
 */
export class AuthorizationService {
  /**
   * Check if user can perform action on resource
   */
  async can(context: AuthorizationContext): Promise<boolean> {
    try {
      // Get user's role
      const role = ROLES[context.user.role]
      if (!role) {
        logger.warn('Unknown role', { role: context.user.role })
        return false
      }

      // Collect all permissions (including inherited)
      const allPermissions = this.collectPermissions(role)

      // Check each permission
      for (const permission of allPermissions) {
        if (permission.resource !== context.resource) continue
        if (!permission.actions.includes(context.action)) continue

        // Check scope
        if (!this.checkScope(permission.scope, context)) continue

        // Check ABAC conditions
        if (!this.checkConditions(permission.conditions, context)) continue

        // Permission granted - log for audit
        await this.logAuthorizationDecision(context, true, permission)
        return true
      }

      // No matching permission found
      await this.logAuthorizationDecision(context, false)
      return false

    } catch (error) {
      logger.error('Authorization check failed', error, { context })
      return false
    }
  }

  /**
   * Require permission (throws if denied)
   */
  async require(context: AuthorizationContext): Promise<void> {
    const allowed = await this.can(context)
    if (!allowed) {
      throw new AuthorizationError(
        `Access denied: ${context.action} on ${context.resource}`,
        context
      )
    }
  }

  /**
   * Check multiple permissions (all must pass)
   */
  async canAll(contexts: AuthorizationContext[]): Promise<boolean> {
    for (const context of contexts) {
      if (!await this.can(context)) {
        return false
      }
    }
    return true
  }

  /**
   * Check multiple permissions (any can pass)
   */
  async canAny(contexts: AuthorizationContext[]): Promise<boolean> {
    for (const context of contexts) {
      if (await this.can(context)) {
        return true
      }
    }
    return false
  }

  /**
   * Collect all permissions including inherited roles
   */
  private collectPermissions(role: Role): Permission[] {
    const permissions = [...role.permissions]

    if (role.inherits) {
      for (const inheritedRoleName of role.inherits) {
        const inheritedRole = ROLES[inheritedRoleName]
        if (inheritedRole) {
          permissions.push(...this.collectPermissions(inheritedRole))
        }
      }
    }

    return permissions
  }

  /**
   * Check scope restrictions
   */
  private checkScope(
    scope: Permission['scope'],
    context: AuthorizationContext
  ): boolean {
    if (!scope || scope === 'all') return true

    const resourceData = context.resourceData
    if (!resourceData) return false

    switch (scope) {
      case 'own':
        return resourceData.userId === context.user.id ||
               resourceData.ownerId === context.user.id ||
               resourceData.createdBy === context.user.id

      case 'department':
        // In production, would check against user's department
        return resourceData.department === (context.user as User & { department?: string }).department

      case 'organization':
        // In production, would check against user's organization
        return resourceData.organization === (context.user as User & { organization?: string }).organization

      default:
        return false
    }
  }

  /**
   * Check ABAC conditions
   */
  private checkConditions(
    conditions: Condition[] | undefined,
    context: AuthorizationContext
  ): boolean {
    if (!conditions || conditions.length === 0) return true

    const data = {
      ...context.resourceData,
      ...context.environment,
      user: context.user
    }

    for (const condition of conditions) {
      const fieldValue = this.getFieldValue(data, condition.field)

      if (!this.evaluateCondition(fieldValue, condition.operator, condition.value)) {
        return false
      }
    }

    return true
  }

  /**
   * Get nested field value from object
   */
  private getFieldValue(obj: Record<string, unknown>, field: string): unknown {
    const parts = field.split('.')
    let value: unknown = obj

    for (const part of parts) {
      if (value == null) return undefined
      value = (value as Record<string, unknown>)[part]
    }

    return value
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    fieldValue: unknown,
    operator: ConditionOperator,
    expectedValue: ConditionValue
  ): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === expectedValue

      case 'not_equals':
        return fieldValue !== expectedValue

      case 'contains':
        return String(fieldValue).includes(String(expectedValue))

      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(fieldValue as string)

      case 'not_in':
        return Array.isArray(expectedValue) && !expectedValue.includes(fieldValue as string)

      case 'greater_than':
        return Number(fieldValue) > Number(expectedValue)

      case 'less_than':
        return Number(fieldValue) < Number(expectedValue)

      case 'matches_regex':
        if (typeof expectedValue !== 'string') return false
        return new RegExp(expectedValue).test(String(fieldValue))

      default:
        return false
    }
  }

  /**
   * Log authorization decision for audit
   */
  private async logAuthorizationDecision(
    context: AuthorizationContext,
    allowed: boolean,
    permission?: Permission
  ): Promise<void> {
    await tamperEvidentAuditLogger.logEvent(
      context.user,
      'security.authorization',
      {
        resourceType: context.resource,
        resourceId: context.resourceData?.id as string | undefined,
        success: allowed,
        metadata: {
          action: context.action,
          allowed,
          permission: permission ? {
            actions: permission.actions,
            scope: permission.scope,
            conditions: permission.conditions
          } : null,
          environment: context.environment
        }
      }
    )
  }

  /**
   * Get effective permissions for a user
   */
  getEffectivePermissions(user: User): Permission[] {
    const role = ROLES[user.role]
    if (!role) return []
    return this.collectPermissions(role)
  }

  /**
   * Check if user has any permission for a resource
   */
  hasAnyAccessToResource(user: User, resource: Resource): boolean {
    const permissions = this.getEffectivePermissions(user)
    return permissions.some(p => p.resource === resource)
  }
}

/**
 * Authorization Error
 */
export class AuthorizationError extends Error {
  constructor(
    message: string,
    public context: AuthorizationContext
  ) {
    super(message)
    this.name = 'AuthorizationError'
  }
}

// Export singleton instance
export const authorizationService = new AuthorizationService()

/**
 * Express/Next.js middleware for authorization
 */
interface AuthRequest {
  user?: User
  body?: Record<string, unknown>
  query?: Record<string, unknown>
  ip?: string
}

interface AuthResponse {
  status: (code: number) => AuthResponse
  json: (data: unknown) => void
}

type NextFunction = () => void

export function requirePermission(resource: Resource, action: Action) {
  return async (req: AuthRequest, res: AuthResponse, next: NextFunction) => {
    try {
      const user = req.user // Assumes user is attached by auth middleware

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const context: AuthorizationContext = {
        user,
        resource,
        action,
        resourceData: req.body || req.query,
        environment: {
          ipAddress: req.ip,
          time: new Date()
        }
      }

      await authorizationService.require(context)
      next()
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return res.status(403).json({ error: error.message })
      }
      return res.status(500).json({ error: 'Authorization check failed' })
    }
  }
}