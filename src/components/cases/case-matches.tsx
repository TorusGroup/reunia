// =============================================================
// CaseMatches — Face match history for a case (Sprint 7, LE-03)
// Server Component — shows match status without sensitive details
// Public view: shows status and confidence, NOT images (privacy)
// =============================================================

interface MatchRow {
  id: string
  similarityScore: number
  confidenceTier: string
  reviewStatus: string
  queryImageUrl: string | null
  querySource: string | null
  requestedAt: string
  reviewedAt: string | null
}

const CONFIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  possible: { label: 'Possivel', color: 'var(--color-text-muted)' },
  likely: { label: 'Provavel', color: 'var(--color-alert-amber)' },
  confident: { label: 'Confiante', color: 'var(--color-found-green)' },
  very_confident: { label: 'Muito Confiante', color: 'var(--color-data-blue)' },
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Aguardando revisao', color: 'var(--color-alert-amber-dark)', bg: 'var(--color-alert-amber-light)' },
  approved: { label: 'Confirmado', color: 'var(--color-found-green-dark)', bg: 'var(--color-found-green-light)' },
  rejected: { label: 'Descartado', color: 'var(--color-text-muted)', bg: 'var(--color-bg-tertiary)' },
  escalated: { label: 'Em analise', color: 'var(--color-data-blue-dark)', bg: 'var(--color-data-blue-light)' },
  expired: { label: 'Expirado', color: 'var(--color-text-muted)', bg: 'var(--color-bg-tertiary)' },
}

const SOURCE_LABELS: Record<string, string> = {
  citizen_upload: 'Upload de cidadao',
  sighting_photo: 'Foto de avistamento',
  ingestion_pipeline: 'Pipeline automatico',
  le_batch: 'Lote policial',
  operator_manual: 'Operador manual',
}

interface CaseMatchesProps {
  matches: MatchRow[]
}

export function CaseMatches({ matches }: CaseMatchesProps) {
  if (matches.length === 0) return null

  const approvedCount = matches.filter((m) => m.reviewStatus === 'approved').length
  const pendingCount = matches.filter((m) => m.reviewStatus === 'pending').length

  return (
    <div>
      {/* Summary */}
      <div className="flex gap-4 mb-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        <span>{matches.length} correspondencia(s) encontrada(s)</span>
        {approvedCount > 0 && (
          <span style={{ color: 'var(--color-found-green)' }}>
            {approvedCount} confirmada(s)
          </span>
        )}
        {pendingCount > 0 && (
          <span style={{ color: 'var(--color-alert-amber)' }}>
            {pendingCount} aguardando revisao
          </span>
        )}
      </div>

      <div className="space-y-2">
        {matches.map((m) => {
          const confidenceCfg = CONFIDENCE_LABELS[m.confidenceTier] ?? CONFIDENCE_LABELS.possible
          const statusCfg = STATUS_LABELS[m.reviewStatus] ?? STATUS_LABELS.pending
          const scorePercent = Math.round(m.similarityScore * 100)

          return (
            <div
              key={m.id}
              className="rounded-lg border p-3 flex items-center justify-between gap-3 flex-wrap"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
              }}
            >
              <div className="flex items-center gap-3">
                {/* Similarity score */}
                <div
                  className="flex items-center justify-center w-12 h-12 rounded-lg"
                  style={{
                    backgroundColor: `${confidenceCfg.color}15`,
                    border: `1.5px solid ${confidenceCfg.color}`,
                  }}
                >
                  <span
                    className="text-sm font-bold"
                    style={{ fontFamily: 'var(--font-mono)', color: confidenceCfg.color }}
                  >
                    {scorePercent}%
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="text-xs font-semibold"
                      style={{ color: confidenceCfg.color }}
                    >
                      {confidenceCfg.label}
                    </span>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: statusCfg.color, backgroundColor: statusCfg.bg }}
                    >
                      {statusCfg.label}
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    <span>
                      {new Date(m.requestedAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                      })}
                    </span>
                    {m.querySource && (
                      <span>{SOURCE_LABELS[m.querySource] ?? m.querySource}</span>
                    )}
                  </div>
                </div>
              </div>

              {m.reviewStatus === 'pending' && (
                <span
                  className="text-xs font-medium px-2 py-1 rounded"
                  style={{
                    backgroundColor: 'var(--color-alert-amber-light)',
                    color: 'var(--color-alert-amber-dark)',
                  }}
                >
                  Em fila HITL
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Privacy note */}
      <p
        className="mt-3 text-xs"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Imagens de correspondencia facial nao sao exibidas publicamente por razoes de privacidade.
        Apenas autoridades policiais podem revisar detalhes completos.
      </p>
    </div>
  )
}
