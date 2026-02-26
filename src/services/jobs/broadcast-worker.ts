import { Worker } from 'bullmq'
import { redisQueue, queues } from '@/lib/redis'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { dispatchToSubscribers } from '@/services/alerts/notification-dispatcher'

// =============================================================
// Broadcast Worker — High-priority AMBER Alert broadcast (Sprint 6)
// Processes high-priority broadcast alerts (AMBER)
// =============================================================

let broadcastWorker: Worker | null = null

export function startBroadcastWorker(): Worker {
  if (broadcastWorker) return broadcastWorker

  broadcastWorker = new Worker(
    'alert-distribution',
    async (job) => {
      const { alertId, triggeredBy } = job.data as { alertId: string; triggeredBy: string }

      // Only this worker handles AMBER_ALERT_APPROVED
      if (triggeredBy !== 'AMBER_ALERT_APPROVED') return

      logger.info({ jobId: job.id, alertId }, 'BroadcastWorker: processing AMBER broadcast')

      const alert = await db.alert.findUnique({
        where: { id: alertId },
        select: {
          id: true,
          title: true,
          messageBody: true,
          imageUrl: true,
          caseUrl: true,
          status: true,
        },
      })

      if (!alert || alert.status === 'cancelled') {
        logger.warn({ alertId }, 'BroadcastWorker: alert not found or cancelled')
        return
      }

      // Broadcast to ALL active subscriptions (no geo filter for AMBER)
      const allSubscribers = await db.alertSubscription.findMany({
        where: { isActive: true },
        select: {
          id: true,
          channel: true,
          contactIdentifier: true,
          userId: true,
        },
      })

      const subscribers = allSubscribers.map((s) => ({
        id: s.id,
        channel: s.channel,
        contactIdentifier: s.contactIdentifier,
        userId: s.userId,
      }))

      logger.info({ alertId, subscriberCount: subscribers.length }, 'BroadcastWorker: broadcasting AMBER to all subscribers')

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
        'BroadcastWorker: AMBER broadcast complete'
      )
    },
    {
      connection: redisQueue,
      concurrency: 1, // AMBER alerts are serialized for safety
    }
  )

  broadcastWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'BroadcastWorker: job completed')
  })

  broadcastWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'BroadcastWorker: job failed')
  })

  logger.info('BroadcastWorker: started')
  return broadcastWorker
}

export async function stopBroadcastWorker(): Promise<void> {
  if (broadcastWorker) {
    await broadcastWorker.close()
    broadcastWorker = null
    logger.info('BroadcastWorker: stopped')
  }
}
