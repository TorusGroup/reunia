import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { writeAuditLog, getIpFromHeaders } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'
import { triggerAlert, approveAndBroadcast } from '@/services/alerts/alert-engine'

// =============================================================
// POST /api/v1/alerts/broadcast  — Admin/LE only: send AMBER Alert
// Sprint 6 — E6-S05
// =============================================================

const broadcastSchema = z.object({
  caseId: z.string().uuid(),
  message: z.string().min(10).max(500).optional(),
  approve: z.boolean().optional().default(false), // true = create AND approve immediately
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getIpFromHeaders(request.headers)
  const userAgent = request.headers.get('user-agent') ?? undefined

  // Require law_enforcement or admin
  const authResult = requireRole(request, 'law_enforcement')
  if (authResult instanceof NextResponse) return authResult

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.VALIDATION_ERROR, message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const validation = broadcastSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    )
  }

  const { caseId, approve } = validation.data

  // Verify case exists and is active
  const alertCase = await db.case.findUnique({
    where: { id: caseId },
    select: { id: true, status: true, caseNumber: true },
  })

  if (!alertCase) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Case not found' } },
      { status: 404 }
    )
  }

  if (alertCase.status !== 'active') {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.CONFLICT, message: 'Can only broadcast for active cases' } },
      { status: 409 }
    )
  }

  try {
    // Create AMBER alert
    const result = await triggerAlert({
      type: 'AMBER_ALERT',
      caseId,
      createdById: authResult.userId,
    })

    if (!result) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Failed to create alert' } },
        { status: 500 }
      )
    }

    writeAuditLog({
      userId: authResult.userId,
      action: 'alerts.create',
      resourceType: 'alert',
      resourceId: result.alertId,
      details: { alertType: 'amber', caseId, caseNumber: alertCase.caseNumber, autoApprove: approve },
      ipAddress: ip,
      userAgent,
    })

    // Auto-approve if requested (LE can approve their own AMBER alerts)
    if (approve) {
      const broadcastResult = await approveAndBroadcast(
        result.alertId,
        authResult.userId,
        'Auto-approved by issuing officer'
      )

      logger.info(
        { alertId: result.alertId, caseId, userId: authResult.userId },
        'Broadcast: AMBER alert created and approved'
      )

      return NextResponse.json(
        {
          success: true,
          data: {
            alertId: result.alertId,
            status: 'broadcasting',
            jobId: broadcastResult.jobId,
            message: 'AMBER Alert approved and queued for broadcast',
          },
        },
        { status: 201 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          alertId: result.alertId,
          status: 'pending_approval',
          message: 'AMBER Alert created — awaiting supervisor approval',
        },
      },
      { status: 201 }
    )
  } catch (err) {
    logger.error({ err, caseId }, 'Broadcast POST: failed')
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Failed to broadcast alert' } },
      { status: 500 }
    )
  }
}
