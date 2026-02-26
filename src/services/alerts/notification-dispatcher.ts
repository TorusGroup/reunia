import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { sendEmail } from '@/services/alerts/channels/email-channel'
import { sendSms } from '@/services/alerts/channels/sms-channel'
import { sendWhatsApp } from '@/services/alerts/channels/whatsapp-channel'
import { sendPush } from '@/services/alerts/channels/push-channel'
import type { SubscriberTarget } from '@/services/alerts/geo-fence'

// =============================================================
// Notification Dispatcher — Route to correct channel (Sprint 6)
// Channels are mock in MVP — real integration Sprint 7+
// =============================================================

export interface DispatchPayload {
  alertId: string
  title: string
  messageBody: string
  imageUrl: string | null
  caseUrl: string | null
}

export interface DispatchResult {
  dispatched: number
  failed: number
  skipped: number
}

/**
 * Dispatch alert to a list of subscribers via their preferred channels.
 */
export async function dispatchToSubscribers(
  payload: DispatchPayload,
  subscribers: SubscriberTarget[]
): Promise<DispatchResult> {
  let dispatched = 0
  let failed = 0
  let skipped = 0

  // Process in batches of 50 to avoid overwhelming
  const BATCH_SIZE = 50
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE)
    await Promise.allSettled(
      batch.map(async (subscriber) => {
        try {
          const result = await dispatchToChannel(subscriber, payload)

          // Record delivery
          await db.alertDelivery.create({
            data: {
              alertId: payload.alertId,
              subscriptionId: subscriber.id,
              channel: subscriber.channel as 'whatsapp' | 'sms' | 'email' | 'push' | 'in_app',
              recipientIdentifier: subscriber.contactIdentifier,
              status: result.success ? 'sent' : 'failed',
              sentAt: result.success ? new Date() : null,
              failedAt: result.success ? null : new Date(),
              failureReason: result.error ?? null,
              externalMessageId: result.externalMessageId ?? null,
            },
          })

          if (result.success) {
            dispatched++
            // Update last alerted timestamp on subscription
            await db.alertSubscription
              .update({
                where: { id: subscriber.id },
                data: {
                  lastAlertedAt: new Date(),
                  alertCount: { increment: 1 },
                },
              })
              .catch(() => {
                // Non-critical — don't fail the dispatch
              })
          } else {
            failed++
          }
        } catch (err) {
          failed++
          logger.error({ err, subscriberId: subscriber.id, channel: subscriber.channel }, 'Dispatcher: failed to dispatch to subscriber')
        }
      })
    )
  }

  // Update alert recipient count
  await db.alert
    .update({
      where: { id: payload.alertId },
      data: {
        recipientCount: dispatched,
        status: 'sent',
        sentAt: new Date(),
      },
    })
    .catch((err: unknown) => logger.error({ err }, 'Dispatcher: failed to update alert status'))

  logger.info(
    { alertId: payload.alertId, dispatched, failed, skipped },
    'Dispatcher: dispatch complete'
  )

  return { dispatched, failed, skipped }
}

async function dispatchToChannel(
  subscriber: SubscriberTarget,
  payload: DispatchPayload
): Promise<{ success: boolean; externalMessageId?: string; error?: string }> {
  const contact = subscriber.contactIdentifier

  switch (subscriber.channel) {
    case 'email':
      return sendEmail({
        to: contact,
        subject: payload.title,
        htmlBody: buildEmailHtml(payload),
        textBody: payload.messageBody,
      })

    case 'sms':
      return sendSms({
        to: contact,
        body: `${payload.title}\n${payload.messageBody}${payload.caseUrl ? `\n${payload.caseUrl}` : ''}`,
      })

    case 'whatsapp':
      return sendWhatsApp({
        to: contact,
        templateName: 'reunia_alert',
        templateParams: [payload.title, payload.messageBody],
        imageUrl: payload.imageUrl ?? undefined,
      })

    case 'push':
      return sendPush({
        subscription: contact,
        title: payload.title,
        body: payload.messageBody,
        url: payload.caseUrl ?? undefined,
      })

    default:
      logger.warn({ channel: subscriber.channel }, 'Dispatcher: unknown channel — skipping')
      return { success: false, error: `Unknown channel: ${subscriber.channel}` }
  }
}

function buildEmailHtml(payload: DispatchPayload): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: Inter, system-ui, sans-serif; color: #111827; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: #2D3561; padding: 20px 24px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 20px;">Reun<span style="color:#E8634A">IA</span></h1>
  </div>
  <div style="border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
    <h2 style="color: #111827; font-size: 18px; margin-top: 0;">${payload.title}</h2>
    <p style="color: #6B7280;">${payload.messageBody}</p>
    ${payload.imageUrl ? `<img src="${payload.imageUrl}" alt="Criança desaparecida" style="width:100%; border-radius:8px; margin-bottom:16px;">` : ''}
    ${payload.caseUrl ? `<a href="${payload.caseUrl}" style="display:inline-block; background:#E8634A; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Ver Caso Completo</a>` : ''}
    <hr style="border:none; border-top:1px solid #E5E7EB; margin: 24px 0;">
    <p style="font-size:12px; color:#9CA3AF;">
      CVV 188 | Disque Denúncia 181 | Emergência 190<br>
      Você está recebendo este alerta porque se inscreveu na ReunIA.
    </p>
  </div>
</body>
</html>`
}
