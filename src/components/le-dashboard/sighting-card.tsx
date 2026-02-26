'use client'

import Image from 'next/image'

// =============================================================
// Sighting Card — Sighting report card with map + photo + actions (Sprint 6)
// =============================================================

export type SightingStatus = 'pending' | 'reviewing' | 'confirmed' | 'rejected' | 'duplicate'

export interface SightingData {
  id: string
  caseId: string | null
  caseNumber: string | null
  description: string
  seenAt: string | null
  locationText: string | null
  latitude: number | null
  longitude: number | null
  photoUrl: string | null
  status: SightingStatus
  isAnonymous: boolean
  reporterName: string | null
  createdAt: string
}

const STATUS_CONFIG: Record<SightingStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pendente', color: 'var(--color-alert-amber-dark)', bg: 'var(--color-alert-amber-light)' },
  reviewing: { label: 'Em revisão', color: 'var(--color-data-blue-dark)', bg: 'var(--color-data-blue-light)' },
  confirmed: { label: 'Confirmado', color: 'var(--color-found-green-dark)', bg: 'var(--color-found-green-light)' },
  rejected: { label: 'Rejeitado', color: 'var(--color-text-muted)', bg: 'var(--color-bg-tertiary)' },
  duplicate: { label: 'Duplicado', color: 'var(--color-text-muted)', bg: 'var(--color-bg-tertiary)' },
}

interface SightingCardProps {
  sighting: SightingData
  onReview: (id: string, status: 'confirmed' | 'rejected', reason?: string) => void
  onLinkCase: (id: string) => void
}

export function SightingCard({ sighting, onReview, onLinkCase }: SightingCardProps) {
  const statusCfg = STATUS_CONFIG[sighting.status]
  const isPending = sighting.status === 'pending' || sighting.status === 'reviewing'

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ color: statusCfg.color, backgroundColor: statusCfg.bg }}
          >
            {statusCfg.label}
          </span>
          {sighting.caseNumber && (
            <span
              className="text-xs"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
            >
              Caso #{sighting.caseNumber}
            </span>
          )}
        </div>
        <span
          className="text-xs"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
        >
          {new Date(sighting.createdAt).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
          })}
        </span>
      </div>

      <div className="p-4">
        <div className="flex gap-4">
          {/* Photo */}
          {sighting.photoUrl ? (
            <div className="relative shrink-0 rounded-lg overflow-hidden" style={{ width: 80, height: 80 }}>
              <Image
                src={sighting.photoUrl}
                alt="Foto do avistamento"
                fill
                className="object-cover"
                sizes="80px"
              />
            </div>
          ) : (
            <div
              className="shrink-0 rounded-lg flex items-center justify-center"
              style={{ width: 80, height: 80, backgroundColor: 'var(--color-bg-tertiary)' }}
            >
              <span style={{ color: 'var(--color-text-muted)' }}>📷</span>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm mb-2" style={{ color: 'var(--color-text-primary)' }}>
              {sighting.description.slice(0, 160)}
              {sighting.description.length > 160 && '...'}
            </p>

            {sighting.locationText && (
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                📍 {sighting.locationText}
              </p>
            )}

            {sighting.seenAt && (
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                🕐 Avistado em: {new Date(sighting.seenAt).toLocaleString('pt-BR')}
              </p>
            )}

            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {sighting.isAnonymous ? 'Anônimo' : sighting.reporterName ?? 'Usuário registrado'}
            </p>
          </div>
        </div>

        {/* Map placeholder if coordinates available */}
        {sighting.latitude && sighting.longitude && (
          <div
            className="mt-3 rounded-lg flex items-center justify-center text-xs"
            style={{
              height: 60,
              backgroundColor: 'var(--color-data-blue-light)',
              color: 'var(--color-data-blue-dark)',
            }}
          >
            📍 {sighting.latitude.toFixed(4)}, {sighting.longitude.toFixed(4)} — Mapa disponível em Sprint 7
          </div>
        )}

        {/* Actions */}
        {isPending && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onReview(sighting.id, 'confirmed')}
              className="flex-1 py-2 text-xs font-semibold rounded-lg text-white transition-all"
              style={{ backgroundColor: 'var(--color-found-green)' }}
            >
              Confirmar
            </button>
            <button
              onClick={() => onReview(sighting.id, 'rejected')}
              className="flex-1 py-2 text-xs font-semibold rounded-lg border transition-all"
              style={{
                borderColor: 'var(--color-warm-gray)',
                color: 'var(--color-warm-gray)',
              }}
            >
              Descartar
            </button>
            {!sighting.caseId && (
              <button
                onClick={() => onLinkCase(sighting.id)}
                className="px-3 py-2 text-xs font-semibold rounded-lg border transition-all"
                style={{
                  borderColor: 'var(--color-data-blue)',
                  color: 'var(--color-data-blue)',
                }}
              >
                Vincular
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
