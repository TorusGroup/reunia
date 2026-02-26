import { db } from '@/lib/db'
import { queues } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { writeAuditLog } from '@/lib/audit'
import type { AlertType } from '@prisma/client'

// =============================================================
// Alert Engine — Core (Sprint 6, E6-S01)
// When new case/match → evaluate subscriptions → dispatch
// =============================================================

export type AlertTrigger =
  | { type: 'NEW_CASE'; caseId: string }
  | { type: 'MATCH_FOUND'; caseId: string; matchId: string }
  | { type: 'CASE_UPDATE'; caseId: string; updateType: string }
  | { type: 'AMBER_ALERT'; caseId: string; createdById: string }
  | { type: 'SIGHTING_REPORT'; caseId: string; sightingId: string }

export interface AlertEngineResult {
  alertId: string
  recipientCount: number
  jobId: string | null
}

/**
 * Evaluate a trigger, create an Alert record, and enqueue for dispatch.
 */
export async function triggerAlert(
  trigger: AlertTrigger
): Promise<AlertEngineResult | null> {
  try {
    const alertCase = await db.case.findUnique({
      where: { id: trigger.caseId },
      include: {
        persons: {
          where: { role: 'missing_child' },
          take: 1,
          include: {
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
    })

    if (!alertCase) {
      logger.warn({ trigger }, 'AlertEngine: case not found for trigger')
      return null
    }

    const { title, body, alertType } = buildAlertMessage(trigger, alertCase)

    // Create alert record
    const alert = await db.alert.create({
      data: {
        caseId: trigger.caseId,
        alertType: alertType as AlertType,
        status: trigger.type === 'AMBER_ALERT' ? 'pending_approval' : 'approved',
        title,
        messageBody: body,
        caseUrl: `/cases/${trigger.caseId}`,
        imageUrl: alertCase.persons[0]?.images[0]?.storageUrl ?? null,
        geoCenterLat: alertCase.lastSeenLat ?? null,
        geoCenterLng: alertCase.lastSeenLng ?? null,
        geoRadiusKm: trigger.type === 'AMBER_ALERT' ? 200 : 50,
        ...(trigger.type === 'AMBER_ALERT'
          ? { createdById: trigger.createdById }
          : {}),
      },
    })

    // AMBER alerts wait for approval — don't dispatch yet
    if (trigger.type === 'AMBER_ALERT') {
      logger.info({ alertId: alert.id, caseId: trigger.caseId }, 'AlertEngine: AMBER alert created — awaiting approval')
      return { alertId: alert.id, recipientCount: 0, jobId: null }
    }

    // Enqueue for distribution
    const job = await queues.alertDistribution.add(
      `alert:${alert.id}`,
      { alertId: alert.id, triggeredBy: trigger.type },
      {
        priority: trigger.type === 'MATCH_FOUND' ? 1 : 5,
        delay: 0,
      }
    )

    logger.info(
      { alertId: alert.id, caseId: trigger.caseId, triggerType: trigger.type, jobId: job.id },
      'AlertEngine: alert enqueued for distribution'
    )

    return {
      alertId: alert.id,
      recipientCount: 0, // updated by worker after fan-out
      jobId: job.id?.toString() ?? null,
    }
  } catch (err) {
    logger.error({ err, trigger }, 'AlertEngine: failed to trigger alert')
    return null
  }
}

/**
 * Approve an AMBER alert and enqueue for broadcast.
 */
export async function approveAndBroadcast(
  alertId: string,
  approverId: string,
  notes?: string
): Promise<{ jobId: string | null }> {
  const alert = await db.alert.update({
    where: { id: alertId },
    data: {
      status: 'approved',
      approvedById: approverId,
      approvedAt: new Date(),
      approvalNotes: notes ?? null,
    },
  })

  const job = await queues.alertDistribution.add(
    `broadcast:${alertId}`,
    { alertId, triggeredBy: 'AMBER_ALERT_APPROVED' },
    { priority: 0 } // Highest priority
  )

  writeAuditLog({
    userId: approverId,
    action: 'alerts.approve',
    resourceType: 'alert',
    resourceId: alertId,
    details: { alertType: alert.alertType, notes },
  })

  return { jobId: job.id?.toString() ?? null }
}

// ---------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------

function buildAlertMessage(
  trigger: AlertTrigger,
  alertCase: { caseNumber: string; persons: { firstName?: string | null; lastName?: string | null }[] }
): { title: string; body: string; alertType: string } {
  const childName = alertCase.persons[0]
    ? [alertCase.persons[0].firstName, alertCase.persons[0].lastName]
        .filter(Boolean)
        .join(' ') || 'Criança'
    : 'Criança'

  switch (trigger.type) {
    case 'NEW_CASE':
      return {
        title: `Novo caso na sua região — ${childName}`,
        body: `Uma nova criança desaparecida foi registrada próxima a você. Caso #${alertCase.caseNumber}. Ajude a compartilhar.`,
        alertType: 'community',
      }
    case 'MATCH_FOUND':
      return {
        title: `Possível correspondência encontrada — ${childName}`,
        body: `O sistema identificou uma possível correspondência para o caso #${alertCase.caseNumber}. Em validação pela equipe.`,
        alertType: 'le_bulletin',
      }
    case 'CASE_UPDATE':
      return {
        title: `Atualização no caso — ${childName}`,
        body: `Há uma nova atualização no caso #${alertCase.caseNumber}. Acesse para ver os detalhes.`,
        alertType: 'community',
      }
    case 'AMBER_ALERT':
      return {
        title: `ALERTA ÂMBAR — ${childName}`,
        body: `ALERTA URGENTE: ${childName} está desaparecida. Caso #${alertCase.caseNumber}. Se tiver informações, ligue 190 ou 188.`,
        alertType: 'amber',
      }
    case 'SIGHTING_REPORT':
      return {
        title: `Avistamento reportado — ${childName}`,
        body: `Um cidadão reportou ter avistado uma criança relacionada ao caso #${alertCase.caseNumber}. Em verificação.`,
        alertType: 'sighting_match',
      }
  }
}
