// =============================================================
// CaseCard — Case card for homepage grid and search results
// 280x360px, photo 1:1, status badge, days missing counter
// Sprint 4, E5
// =============================================================

import Link from 'next/link'
import type { CaseSummary, PersonSummary } from '@/types/cases'

// Compute days missing from lastSeenAt
function daysMissing(lastSeenAt?: string): number | null {
  if (!lastSeenAt) return null
  const diff = Date.now() - new Date(lastSeenAt).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

// Color coding per wireframe spec
function daysColor(days: number): string {
  if (days <= 7) return 'var(--color-alert-amber)'
  if (days <= 30) return 'var(--color-coral-hope)'
  return 'var(--color-deep-indigo)'
}

function getPersonDisplay(person: PersonSummary) {
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ') || person.nickname || 'Identidade desconhecida'
  const age = person.approximateAge ?? (person.dateOfBirth
    ? Math.floor((Date.now() - new Date(person.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null)
  return { name, age }
}

interface CaseCardProps {
  caseData: CaseSummary
  priority?: boolean // for homepage above-fold cards
}

export function CaseCard({ caseData, priority = false }: CaseCardProps) {
  const person = caseData.persons[0]
  if (!person) return null

  const { name, age } = getPersonDisplay(person)
  const days = daysMissing(caseData.lastSeenAt)
  const hasPhoto = !!person.primaryImageUrl

  const statusLabels: Record<string, string> = {
    active: 'ATIVO',
    resolved: 'ENCONTRADO',
    pending_review: 'EM REVISÃO',
    closed: 'FECHADO',
    archived: 'ARQUIVADO',
    draft: 'RASCUNHO',
  }

  const statusColors: Record<string, { bg: string; text: string }> = {
    active: { bg: 'var(--color-alert-amber-light)', text: '#92400E' },
    resolved: { bg: 'var(--color-found-green-light)', text: 'var(--color-found-green-dark)' },
    pending_review: { bg: 'var(--color-alert-amber-light)', text: '#92400E' },
    closed: { bg: 'var(--color-bg-tertiary)', text: 'var(--color-text-muted)' },
    archived: { bg: 'var(--color-bg-tertiary)', text: 'var(--color-text-muted)' },
    draft: { bg: 'var(--color-bg-tertiary)', text: 'var(--color-text-muted)' },
  }

  const { bg: statusBg, text: statusText } = statusColors[caseData.status] ?? statusColors.archived

  return (
    <Link
      href={`/case/${caseData.id}`}
      className="group block rounded-xl overflow-hidden transition-all duration-150"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
      }}
      role="article"
      aria-label={`${name}, ${age ? `${age} anos` : 'idade desconhecida'}${days != null ? `, desaparecida(o) há ${days} dias` : ''}`}
    >
      {/* Photo area — 1:1 aspect ratio */}
      <div
        className="relative w-full aspect-square overflow-hidden"
        style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
      >
        {hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.primaryImageUrl!}
            alt={`Foto de ${name}`}
            className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
            loading={priority ? 'eager' : 'lazy'}
          />
        ) : (
          /* Silhouette fallback per wireframe */
          <div className="w-full h-full flex items-center justify-center">
            <svg
              width="80"
              height="100"
              viewBox="0 0 80 100"
              fill="none"
              aria-label="Sem foto disponível"
            >
              <circle cx="40" cy="28" r="18" fill="#D1D5DB" />
              <path
                d="M6 88c0-18.778 15.222-34 34-34s34 15.222 34 34"
                stroke="#D1D5DB"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        )}

        {/* Status badge overlay */}
        <span
          className="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-semibold"
          style={{
            backgroundColor: statusBg,
            color: statusText,
            fontFamily: 'var(--font-body)',
          }}
        >
          {statusLabels[caseData.status] ?? caseData.status}
        </span>
      </div>

      {/* Card content */}
      <div className="p-3">
        <p
          className="font-semibold text-base truncate"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
        >
          {name}
        </p>
        {age != null && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {age} anos
          </p>
        )}
        {caseData.lastSeenLocation && (
          <p
            className="text-sm mt-0.5 truncate"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {caseData.lastSeenLocation}
          </p>
        )}

        {/* Days missing */}
        {days != null && (
          <p className="mt-2 text-sm">
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: daysColor(days),
              }}
            >
              {days}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>
              {' '}
              {days === 1 ? 'dia' : 'dias'}
            </span>
          </p>
        )}
      </div>
    </Link>
  )
}
