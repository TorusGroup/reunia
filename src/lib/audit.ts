import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// =============================================================
// Audit Logging Utility (E1-S07)
// Immutable audit trail — INSERT only, asynchronous
// =============================================================

export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.register'
  | 'auth.login_failed'
  | 'auth.account_locked'
  | 'auth.password_reset_request'
  | 'auth.password_reset_complete'
  | 'auth.email_verified'
  | 'auth.mfa_setup'
  | 'auth.mfa_verified'
  | 'cases.search'
  | 'cases.view'
  | 'cases.create'
  | 'cases.update'
  | 'cases.delete'
  | 'persons.view'
  | 'persons.create'
  | 'persons.update'
  | 'images.upload'
  | 'images.view'
  | 'face_match.submit'
  | 'face_match.view_result'
  | 'hitl.review'
  | 'sightings.create'
  | 'sightings.review'
  | 'alerts.create'
  | 'alerts.approve'
  | 'alerts.send'
  | 'data_sources.trigger'
  | 'users.view'
  | 'users.update'
  | 'users.delete'
  | 'admin.action'

export interface AuditLogEntry {
  userId?: string
  action: AuditAction
  resourceType: string
  resourceId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

// Write audit log entry asynchronously (non-blocking)
// Fire-and-forget pattern — response is NOT delayed by logging
export function writeAuditLog(entry: AuditLogEntry): void {
  // Fire and forget — do NOT await this
  db.auditLog
    .create({
      data: {
        userId: entry.userId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        details: (entry.details ?? {}) as Record<string, unknown>,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        timestamp: new Date(),
      },
    })
    .catch((err: unknown) => {
      // Log but don't throw — audit failures should never break the app
      logger.error({ err, entry }, 'Failed to write audit log')
    })
}

// Synchronous version for critical operations that need confirmation
export async function writeAuditLogSync(entry: AuditLogEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        details: (entry.details ?? {}) as Record<string, unknown>,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        timestamp: new Date(),
      },
    })
  } catch (err) {
    logger.error({ err, entry }, 'Failed to write audit log (sync)')
    // Do not rethrow — audit log failure should not break the operation
  }
}

// Extract IP from Next.js request headers
export function getIpFromHeaders(headers: Headers): string | undefined {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    undefined
  )
}
