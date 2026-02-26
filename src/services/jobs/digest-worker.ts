import { Worker, Queue } from 'bullmq'
import { redisQueue } from '@/lib/redis'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { sendEmail } from '@/services/alerts/channels/email-channel'

// =============================================================
// Digest Worker — Daily/weekly alert digest compilation (Sprint 6)
// =============================================================

export const digestQueue = new Queue('alert-digest', {
  connection: redisQueue,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
})

let digestWorker: Worker | null = null

export function startDigestWorker(): Worker {
  if (digestWorker) return digestWorker

  digestWorker = new Worker(
    'alert-digest',
    async (job) => {
      const { userId, frequency } = job.data as { userId: string; frequency: 'daily' | 'weekly' }

      logger.info({ jobId: job.id, userId, frequency }, 'DigestWorker: generating digest')

      try {
        const user = await db.user.findUnique({
          where: { id: userId },
          select: { email: true, fullName: true },
        })

        if (!user) {
          logger.warn({ userId }, 'DigestWorker: user not found')
          return
        }

        // Get recent alerts for this user's region (last 24h for daily, 7d for weekly)
        const since = new Date()
        since.setHours(frequency === 'daily' ? since.getHours() - 24 : since.getDate() - 7)

        const recentAlerts = await db.alertDelivery.findMany({
          where: {
            subscription: { userId },
            sentAt: { gte: since },
            status: 'sent',
          },
          include: {
            alert: {
              select: { title: true, messageBody: true, caseUrl: true, sentAt: true },
            },
          },
          take: 20,
          orderBy: { sentAt: 'desc' },
        })

        if (recentAlerts.length === 0) {
          logger.info({ userId, frequency }, 'DigestWorker: no alerts to digest')
          return
        }

        // Build digest email
        const digestHtml = buildDigestHtml(user.fullName, recentAlerts, frequency)

        await sendEmail({
          to: user.email,
          subject: `ReunIA — Resumo ${frequency === 'daily' ? 'diário' : 'semanal'} de alertas`,
          htmlBody: digestHtml,
          textBody: `Você recebeu ${recentAlerts.length} alertas. Acesse reunia.org para ver todos.`,
        })

        logger.info({ userId, frequency, alertCount: recentAlerts.length }, 'DigestWorker: digest sent')
      } catch (err) {
        logger.error({ err, userId, frequency }, 'DigestWorker: failed to send digest')
        throw err
      }
    },
    {
      connection: redisQueue,
      concurrency: 5,
    }
  )

  digestWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'DigestWorker: job completed')
  })

  digestWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'DigestWorker: job failed')
  })

  logger.info('DigestWorker: started')
  return digestWorker
}

export async function stopDigestWorker(): Promise<void> {
  if (digestWorker) {
    await digestWorker.close()
    digestWorker = null
  }
}

function buildDigestHtml(
  fullName: string,
  alerts: Array<{ alert: { title: string; messageBody: string; caseUrl: string | null; sentAt: Date | null } }>,
  frequency: string
): string {
  const alertItems = alerts
    .map(
      (d) =>
        `<li style="margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid #E5E7EB;">
          <strong style="color:#111827;">${d.alert.title}</strong><br>
          <span style="color:#6B7280; font-size:14px;">${d.alert.messageBody.slice(0, 120)}...</span>
          ${d.alert.caseUrl ? `<br><a href="${d.alert.caseUrl}" style="color:#E8634A; font-size:14px;">Ver caso →</a>` : ''}
        </li>`
    )
    .join('')

  return `
<!DOCTYPE html>
<html>
<body style="font-family:Inter,system-ui,sans-serif; color:#111827; max-width:600px; margin:0 auto; padding:24px;">
  <div style="background:#2D3561; padding:20px 24px; border-radius:12px 12px 0 0;">
    <h1 style="color:white; margin:0; font-size:20px;">Reun<span style="color:#E8634A">IA</span> — Resumo ${frequency === 'daily' ? 'Diário' : 'Semanal'}</h1>
  </div>
  <div style="border:1px solid #E5E7EB; border-top:none; border-radius:0 0 12px 12px; padding:24px;">
    <p style="color:#111827;">Olá, ${fullName}.</p>
    <p style="color:#6B7280;">${alerts.length} alertas recebidos no período:</p>
    <ul style="list-style:none; padding:0;">${alertItems}</ul>
    <hr style="border:none; border-top:1px solid #E5E7EB; margin:24px 0;">
    <p style="font-size:12px; color:#9CA3AF;">CVV 188 | Disque Denúncia 181 | Emergência 190</p>
  </div>
</body>
</html>`
}
