// =============================================================
// CaseSightings — Sighting history for a case (Sprint 7, LE-03)
// Server Component — rendered from case detail page
// =============================================================

interface SightingRow {
  id: string
  description: string
  seenAt: string | null
  locationText: string | null
  latitude: number | null
  longitude: number | null
  photoUrl: string | null
  status: string
  isAnonymous: boolean
  createdAt: string
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pendente', color: 'var(--color-alert-amber-dark)', bg: 'var(--color-alert-amber-light)' },
  reviewing: { label: 'Em revisao', color: 'var(--color-data-blue-dark)', bg: 'var(--color-data-blue-light)' },
  confirmed: { label: 'Confirmado', color: 'var(--color-found-green-dark)', bg: 'var(--color-found-green-light)' },
  rejected: { label: 'Descartado', color: 'var(--color-text-muted)', bg: 'var(--color-bg-tertiary)' },
  duplicate: { label: 'Duplicado', color: 'var(--color-text-muted)', bg: 'var(--color-bg-tertiary)' },
}

interface CaseSightingsProps {
  sightings: SightingRow[]
}

export function CaseSightings({ sightings }: CaseSightingsProps) {
  if (sightings.length === 0) return null

  return (
    <div className="space-y-3">
      {sightings.map((s) => {
        const statusCfg = STATUS_LABELS[s.status] ?? STATUS_LABELS.pending
        return (
          <div
            key={s.id}
            className="rounded-lg border p-4"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-secondary)',
            }}
          >
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ color: statusCfg.color, backgroundColor: statusCfg.bg }}
              >
                {statusCfg.label}
              </span>
              <span
                className="text-xs"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
              >
                {new Date(s.createdAt).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            <p className="text-sm mb-2" style={{ color: 'var(--color-text-primary)' }}>
              {s.description.length > 200 ? `${s.description.slice(0, 200)}...` : s.description}
            </p>

            <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {s.locationText && (
                <span>Local: {s.locationText}</span>
              )}
              {s.seenAt && (
                <span>
                  Visto em:{' '}
                  {new Date(s.seenAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
              {s.isAnonymous && (
                <span style={{ color: 'var(--color-text-muted)' }}>Anonimo</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
