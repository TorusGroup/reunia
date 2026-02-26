import { Worker } from 'bullmq'
import { redisQueue } from '@/lib/redis'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { findSubscribersForAlert } from '@/services/alerts/geo-fence'
import { dispatchToSubscribers } from '@/services/alerts/notification-dispatcher'

// =============================================================
// Alert Worker — Process alert queue (Sprint 6, E6-S04)
// Evaluate → Dispatch → Log
// =============================================================

let alertWorker: Worker | null = null

export function startAlertWorker(): Worker {
  if (alertWorker) return alertWorker

  alertWorker = new Worker(
    'alert-distribution',
    async (job) => {
      const { alertId } = job.data as { alertId: string; triggeredBy: string }

      logger.info({ jobId: job.id, alertId }, 'AlertWorker: processing alert')

      try {
        const alert = await db.alert.findUnique({
          where: { id: alertId },
          select: {
            id: true,
            title: true,
            messageBody: true,
            imageUrl: true,
            caseUrl: true,
            status: true,
            alertType: true,
          },
        })

        if (!alert) {
          logger.warn({ alertId }, 'AlertWorker: alert not found — skipping')
          return
        }

        if (alert.status === 'cancelled' || alert.status === 'expired') {
          logger.info({ alertId, status: alert.status }, 'AlertWorker: alert cancelled/expired — skipping')
          return
        }

        // Find subscribers via geo-fence
        const subscribers = await findSubscribersForAlert(alertId)

        if (subscribers.length === 0) {
          logger.info({ alertId }, 'AlertWorker: no subscribers in radius — alert sent with 0 recipients')
          await db.alert.update({
            where: { id: alertId },
            data: { status: 'sent', sentAt: new Date(), recipientCount: 0 },
          })
          return
        }

        // Dispatch to all subscribers
        const result = await dispatchToSubscribers(
          {
            alertId: alert.id,
            title: alert.title,
            messageBody: alert.messageBody,
            imageUrl: alert.imageUrl,
            caseUrl: alert.caseUrl,
          },
          subscribers
        )

        logger.info(
          { jobId: job.id, alertId, ...result },
          'AlertWorker: dispatch complete'
        )
      } catch (err) {
        logger.error({ err, jobId: job.id, alertId }, 'AlertWorker: job failed')
        throw err // BullMQ will retry
      }
    },
    {
      connection: redisQueue,
      concurrency: 3,
    }
  )

  alertWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'AlertWorker: job completed')
  })

  alertWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'AlertWorker: job failed')
  })

  logger.info('AlertWorker: started')
  return alertWorker
}

export async function stopAlertWorker(): Promise<void> {
  if (alertWorker) {
    await alertWorker.close()
    alertWorker = null
    logger.info('AlertWorker: stopped')
  }
}
