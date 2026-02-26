// =============================================================
// Alert Template — New Case (Sprint 6)
// =============================================================

export interface CaseAlertData {
  childName: string
  caseNumber: string
  lastSeen: string
  caseUrl: string
}

export function buildNewCaseAlert(data: CaseAlertData) {
  return {
    title: `Novo caso próximo a você — ${data.childName}`,
    body: `Uma nova criança desaparecida foi registrada próxima à sua localização. ${data.childName}, caso #${data.caseNumber}, vista pela última vez em ${data.lastSeen}. Ajude a compartilhar.`,
    cta: 'Ver caso completo',
    ctaUrl: data.caseUrl,
    urgency: 'standard' as const,
  }
}
