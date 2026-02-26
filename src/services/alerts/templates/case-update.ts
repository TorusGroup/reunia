// =============================================================
// Alert Template — Case Update (Sprint 6)
// =============================================================

export interface CaseUpdateData {
  childName: string
  caseNumber: string
  updateType: string
  caseUrl: string
}

export function buildCaseUpdateAlert(data: CaseUpdateData) {
  return {
    title: `Atualização no caso — ${data.childName}`,
    body: `O caso #${data.caseNumber} foi atualizado: ${data.updateType}. Acesse para ver os detalhes mais recentes.`,
    cta: 'Ver atualização',
    ctaUrl: data.caseUrl,
    urgency: 'standard' as const,
  }
}
