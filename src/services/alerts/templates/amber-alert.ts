// =============================================================
// Alert Template — AMBER Alert Broadcast (Sprint 6)
// High urgency — broadcast to all subscribers in region
// =============================================================

export interface AmberAlertData {
  childName: string
  caseNumber: string
  lastSeen: string
  description: string
  caseUrl: string
}

export function buildAmberAlert(data: AmberAlertData) {
  return {
    title: `⚠ ALERTA ÂMBAR — ${data.childName}`,
    body: `ALERTA URGENTE: ${data.childName} (caso #${data.caseNumber}) está desaparecida desde ${data.lastSeen}. ${data.description} Se tiver informações, ligue IMEDIATAMENTE para 190 (Polícia) ou 188 (CVV).`,
    cta: 'Ver alerta completo',
    ctaUrl: data.caseUrl,
    urgency: 'critical' as const,
  }
}
