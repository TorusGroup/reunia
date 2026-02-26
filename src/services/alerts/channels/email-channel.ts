import { logger } from '@/lib/logger'

// =============================================================
// Email Channel — Mock (Sprint 6, E6-S03)
// Real Nodemailer/Resend integration in Sprint 7+
// =============================================================

export interface EmailPayload {
  to: string
  subject: string
  htmlBody: string
  textBody: string
}

export interface ChannelResult {
  success: boolean
  externalMessageId?: string
  error?: string
}

export async function sendEmail(payload: EmailPayload): Promise<ChannelResult> {
  // MOCK: Log to console — store in DB via caller
  logger.info(
    {
      channel: 'email',
      to: payload.to,
      subject: payload.subject,
    },
    '[MOCK] Email notification sent'
  )

  // Simulate 5% failure rate for testing
  if (Math.random() < 0.05) {
    return { success: false, error: 'Mock email delivery failure' }
  }

  return {
    success: true,
    externalMessageId: `mock-email-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  }
}
