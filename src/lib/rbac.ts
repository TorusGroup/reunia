import type { UserRole } from '@/types/auth'
import { hasRole } from '@/lib/auth'

// =============================================================
// Role-Based Access Control (RBAC) (E1-S04)
// Permission matrix per architecture doc section 3.5
// =============================================================

// Permission definitions
export type Permission =
  // Public (any visitor)
  | 'cases:search'
  | 'cases:view_public'
  | 'cases:view_active'
  | 'sightings:create_anonymous'
  // Family
  | 'cases:register'
  | 'cases:view_own'
  | 'sightings:create'
  | 'alerts:subscribe'
  // Volunteer
  | 'sightings:view'
  // NGO
  | 'cases:view_all'
  | 'cases:update_own_org'
  | 'ingestion:trigger'
  // Law Enforcement
  | 'cases:view_full'
  | 'cases:update_any'
  | 'cases:view_restricted'
  | 'face_match:submit'
  | 'face_match:view_results'
  | 'hitl:review'
  | 'alerts:create'
  | 'alerts:approve'
  | 'sightings:review'
  | 'audit_log:view'
  | 'le_dashboard:access'
  // Admin
  | 'users:manage'
  | 'organizations:manage'
  | 'data_sources:manage'
  | 'system:full_access'

// Permission matrix: which minimum role is required for each permission
const PERMISSION_ROLES: Record<Permission, UserRole> = {
  // Public permissions
  'cases:search': 'public',
  'cases:view_public': 'public',
  'cases:view_active': 'public',
  'sightings:create_anonymous': 'public',
  // Family permissions
  'cases:register': 'family',
  'cases:view_own': 'family',
  'sightings:create': 'family',
  'alerts:subscribe': 'public', // Anyone can subscribe to alerts
  // Volunteer permissions
  'sightings:view': 'volunteer',
  // NGO permissions
  'cases:view_all': 'ngo',
  'cases:update_own_org': 'ngo',
  'ingestion:trigger': 'ngo',
  // Law Enforcement permissions
  'cases:view_full': 'law_enforcement',
  'cases:update_any': 'law_enforcement',
  'cases:view_restricted': 'law_enforcement',
  'face_match:submit': 'volunteer', // Volunteers can submit photos for matching
  'face_match:view_results': 'law_enforcement', // But only LE can view match results
  'hitl:review': 'law_enforcement',
  'alerts:create': 'law_enforcement',
  'alerts:approve': 'law_enforcement',
  'sightings:review': 'law_enforcement',
  'audit_log:view': 'law_enforcement',
  'le_dashboard:access': 'law_enforcement',
  // Admin permissions
  'users:manage': 'admin',
  'organizations:manage': 'admin',
  'data_sources:manage': 'admin',
  'system:full_access': 'admin',
}

// Check if a user role has a specific permission
export function can(userRole: UserRole, permission: Permission): boolean {
  const requiredRole = PERMISSION_ROLES[permission]
  if (!requiredRole) return false
  return hasRole(userRole, requiredRole)
}

// Check multiple permissions (AND logic — user must have ALL)
export function canAll(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.every((p) => can(userRole, p))
}

// Check multiple permissions (OR logic — user must have AT LEAST ONE)
export function canAny(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => can(userRole, p))
}

// Get all permissions for a role
export function getPermissionsForRole(userRole: UserRole): Permission[] {
  return (Object.keys(PERMISSION_ROLES) as Permission[]).filter((permission) =>
    can(userRole, permission)
  )
}

// Type guard for valid roles
export function isValidRole(role: unknown): role is UserRole {
  const validRoles: UserRole[] = [
    'public',
    'family',
    'volunteer',
    'ngo',
    'law_enforcement',
    'admin',
  ]
  return typeof role === 'string' && validRoles.includes(role as UserRole)
}
