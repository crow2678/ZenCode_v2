/**
 * ZenCode V2 - Audit Logging Helper
 *
 * Fire-and-forget audit log insertion.
 */

import { AuditLog, type AuditAction } from '@/lib/db/models/audit-log'

interface AuditLogInput {
  orgId: string
  userId: string
  action: AuditAction
  projectId?: string
  resourceId?: string
  metadata?: Record<string, unknown>
  result?: 'success' | 'failure'
  error?: string
}

/**
 * Fire-and-forget audit log entry.
 * Never throws — logs errors to console.
 */
export function auditLog(input: AuditLogInput): void {
  AuditLog.create({
    orgId: input.orgId,
    userId: input.userId,
    action: input.action,
    projectId: input.projectId,
    resourceId: input.resourceId,
    metadata: input.metadata,
    result: input.result || 'success',
    error: input.error,
  }).catch((err) => {
    console.error('[Audit] Failed to write audit log:', err)
  })
}
