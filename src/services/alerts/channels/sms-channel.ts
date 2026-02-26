import { logger } from '@/lib/logger'

// =============================================================
// SMS Channel — Mock (Sprint 6, E6-S03)
// Real Twilio integration in Sprint 7+
// =============================================================

export interface SmsPayload {
  to: string    // E.164 format: +5511999999999
  body: string  // Max 160 chars for single SMS
}

export interface ChannelResult {
  success: boolean
  externalMessageId?: string
  error?: string
}

export async function sendSms(payload: SmsPayload): Promise<ChannelResult> {
  // MOCK: Log to console
  logger.info(
    {
      channel: 'sms',
      to: payload.to,
      bodyLength: payload.body.length,
    },
    '[MOCK] SMS notification sent'
  )

  if (Math.random() < 0.05) {
    return { success: false, error: 'Mock SMS delivery failure' }
  }

  return {
    success: true,
    externalMessageId: `mock-sms-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  }
}
