// =============================================================
// RBAC module unit tests (Q-01)
// Tests: permission checks, role hierarchy, getPermissions
// =============================================================

import { can, canAll, canAny, getPermissionsForRole, isValidRole, type Permission } from '@/lib/rbac'
import type { UserRole } from '@/types/auth'

describe('rbac', () => {
  // ---------------------------------------------------------------
  // Single permission checks
  // ---------------------------------------------------------------
  describe('can', () => {
    it('should allow public users to search cases', () => {
      expect(can('public', 'cases:search')).toBe(true)
      expect(can('public', 'cases:view_public')).toBe(true)
      expect(can('public', 'cases:view_active')).toBe(true)
    })

    it('should deny public users admin permissions', () => {
      expect(can('public', 'users:manage')).toBe(false)
      expect(can('public', 'system:full_access')).toBe(false)
    })

    it('should allow family users to register cases', () => {
      expect(can('family', 'cases:register')).toBe(true)
      expect(can('family', 'cases:view_own')).toBe(true)
      expect(can('family', 'sightings:create')).toBe(true)
    })

    it('should allow volunteers to submit face matches', () => {
      expect(can('volunteer', 'face_match:submit')).toBe(true)
      expect(can('volunteer', 'sightings:view')).toBe(true)
    })

    it('should deny volunteers from viewing match results', () => {
      expect(can('volunteer', 'face_match:view_results')).toBe(false)
    })

    it('should allow law_enforcement to access LE dashboard', () => {
      expect(can('law_enforcement', 'le_dashboard:access')).toBe(true)
      expect(can('law_enforcement', 'hitl:review')).toBe(true)
      expect(can('law_enforcement', 'cases:view_full')).toBe(true)
      expect(can('law_enforcement', 'audit_log:view')).toBe(true)
    })

    it('should allow admin to do everything', () => {
      expect(can('admin', 'users:manage')).toBe(true)
      expect(can('admin', 'organizations:manage')).toBe(true)
      expect(can('admin', 'system:full_access')).toBe(true)
      expect(can('admin', 'cases:search')).toBe(true)
      expect(can('admin', 'le_dashboard:access')).toBe(true)
    })

    it('should respect role hierarchy (higher roles inherit lower permissions)', () => {
      // Admin inherits LE permissions
      expect(can('admin', 'hitl:review')).toBe(true)
      // LE inherits NGO permissions
      expect(can('law_enforcement', 'cases:view_all')).toBe(true)
      // NGO inherits volunteer permissions
      expect(can('ngo', 'sightings:view')).toBe(true)
    })
  })

  // ---------------------------------------------------------------
  // Multi-permission checks
  // ---------------------------------------------------------------
  describe('canAll', () => {
    it('should return true when user has ALL permissions', () => {
      expect(canAll('admin', ['users:manage', 'cases:search'])).toBe(true)
    })

    it('should return false when user is missing any permission', () => {
      expect(canAll('family', ['cases:register', 'users:manage'])).toBe(false)
    })

    it('should return true for empty permissions array', () => {
      expect(canAll('public', [])).toBe(true)
    })
  })

  describe('canAny', () => {
    it('should return true when user has at least one permission', () => {
      expect(canAny('family', ['users:manage', 'cases:register'])).toBe(true)
    })

    it('should return false when user has none of the permissions', () => {
      expect(canAny('public', ['users:manage', 'hitl:review'])).toBe(false)
    })

    it('should return false for empty permissions array', () => {
      expect(canAny('public', [])).toBe(false)
    })
  })

  // ---------------------------------------------------------------
  // getPermissionsForRole
  // ---------------------------------------------------------------
  describe('getPermissionsForRole', () => {
    it('should return more permissions for higher roles', () => {
      const publicPerms = getPermissionsForRole('public')
      const familyPerms = getPermissionsForRole('family')
      const adminPerms = getPermissionsForRole('admin')

      expect(familyPerms.length).toBeGreaterThan(publicPerms.length)
      expect(adminPerms.length).toBeGreaterThan(familyPerms.length)
    })

    it('should include all permissions for admin', () => {
      const adminPerms = getPermissionsForRole('admin')
      expect(adminPerms).toContain('users:manage')
      expect(adminPerms).toContain('system:full_access')
      expect(adminPerms).toContain('cases:search')
    })

    it('should NOT include admin permissions for public', () => {
      const publicPerms = getPermissionsForRole('public')
      expect(publicPerms).not.toContain('users:manage')
      expect(publicPerms).not.toContain('hitl:review')
    })
  })

  // ---------------------------------------------------------------
  // isValidRole
  // ---------------------------------------------------------------
  describe('isValidRole', () => {
    it('should validate known roles', () => {
      expect(isValidRole('public')).toBe(true)
      expect(isValidRole('family')).toBe(true)
      expect(isValidRole('volunteer')).toBe(true)
      expect(isValidRole('ngo')).toBe(true)
      expect(isValidRole('law_enforcement')).toBe(true)
      expect(isValidRole('admin')).toBe(true)
    })

    it('should reject unknown roles', () => {
      expect(isValidRole('superadmin')).toBe(false)
      expect(isValidRole('')).toBe(false)
      expect(isValidRole(null)).toBe(false)
      expect(isValidRole(undefined)).toBe(false)
      expect(isValidRole(123)).toBe(false)
    })
  })
})
