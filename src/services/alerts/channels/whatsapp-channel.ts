import { logger } from '@/lib/logger'

// =============================================================
// WhatsApp Channel — Mock (Sprint 6, E6-S03)
// Real WhatsApp Business API integration in Sprint 7
// Placeholder per sprint spec
// =============================================================

export interface WhatsAppPayload {
  to: string          // E.164 format: +5511999999999
  templateName: string
  templateParams: string[]
  imageUrl?: string
}

export interface ChannelResult {
  success: boolean
  externalMessageId?: string
  error?: string
}

export async function sendWhatsApp(payload: WhatsAppPayload): Promise<ChannelResult> {
  // MOCK: Log to console — real WhatsApp Business API in Sprint 7
  logger.info(
    {
      channel: 'whatsapp',
      to: payload.to,
      template: payload.templateName,
      paramsCount: payload.templateParams.length,
    },
    '[MOCK] WhatsApp notification sent'
  )

  if (Math.random() < 0.05) {
    return { success: false, error: 'Mock WhatsApp delivery failure' }
  }

  return {
    success: true,
    externalMessageId: `mock-wa-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  }
}
