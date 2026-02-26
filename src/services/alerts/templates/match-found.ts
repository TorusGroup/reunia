// =============================================================
// Alert Template — Match Found (Sprint 6)
// Sent to: case family + law enforcement
// =============================================================

export interface MatchAlertData {
  childName: string
  caseNumber: string
  confidenceTier: string
  caseUrl: string
}

export function buildMatchFoundAlert(data: MatchAlertData) {
  return {
    title: `Possível correspondência — ${data.childName}`,
    body: `O sistema identificou uma possível correspondência (confiança: ${data.confidenceTier}) para o caso #${data.caseNumber}. Nossa equipe está validando. Aguarde o contato.`,
    cta: 'Ver detalhes do caso',
    ctaUrl: data.caseUrl,
    urgency: 'high' as const,
  }
}
