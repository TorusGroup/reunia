import { logger } from '@/lib/logger'

// =============================================================
// Web Push Channel — Mock (Sprint 6, E6-S03)
// Real Web Push (webpush-vapid) integration in Sprint 7+
// =============================================================

export interface PushPayload {
  subscription: string   // JSON-serialized PushSubscription
  title: string
  body: string
  icon?: string
  url?: string
}

export interface ChannelResult {
  success: boolean
  externalMessageId?: string
  error?: string
}

export async function sendPush(payload: PushPayload): Promise<ChannelResult> {
  // MOCK: Log to console
  logger.info(
    {
      channel: 'push',
      title: payload.title,
      hasUrl: Boolean(payload.url),
    },
    '[MOCK] Web Push notification sent'
  )

  if (Math.random() < 0.05) {
    return { success: false, error: 'Mock push delivery failure' }
  }

  return {
    success: true,
    externalMessageId: `mock-push-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  }
}
