'use client'

// =============================================================
// SearchResults — Results list with toggle grid/list view
// Sprint 4, E5
// =============================================================

import Link from 'next/link'
import type { CaseSummary } from '@/types/cases'
import { EmptyState } from '@/components/common/empty-state'
import { SkeletonResultRow } from '@/components/common/loading'

// Source badge colors per wireframe spec
const SOURCE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  fbi: { bg: '#DBEAFE', text: '#1D4ED8', label: 'FBI' },
  interpol: { bg: '#E0F2FE', text: '#0369A1', label: 'INTERPOL' },
  ncmec: { bg: '#EDE9FE', text: '#5B21B6', label: 'NCMEC' },
  amber: { bg: '#FEF3C7', text: '#92400E', label: 'AMBER' },
  platform: { bg: '#EEF0FD', text: '#2D3561', label: 'PLATAFORMA' },
  disque100: { bg: '#D1FAE5', text: '#047857', label: 'DISQUE 100' },
}

function daysMissing(lastSeenAt?: string): number | null {
  if (!lastSeenAt) return null
  return Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60 * 24))
}

function daysColor(days: number): string {
  if (days <= 7) return 'var(--color-alert-amber)'
  if (days <= 30) return 'var(--color-coral-hope)'
  return 'var(--color-deep-indigo)'
}

interface SearchResultRowProps {
  caseData: CaseSummary
}

function SearchResultRow({ caseData }: SearchResultRowProps) {
  const person = caseData.persons[0]
  if (!person) return null

  const name = [person.firstName, person.lastName].filter(Boolean).join(' ') || person.nickname || 'Identidade desconhecida'
  const age = person.approximateAge ?? null
  const days = daysMissing(caseData.lastSeenAt)
  const source = SOURCE_COLORS[caseData.source] ?? SOURCE_COLORS.platform
  const hasPhoto = !!person.primaryImageUrl

  return (
    <article
      role="article"
      aria-label={`${name}${age ? `, ${age} anos` : ''}${days != null ? `, desaparecida(o) há ${days} dias` : ''}`}
      className="group flex items-start gap-4 p-4 rounded-xl transition-all duration-150 hover:border-l-4"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border)',
        borderLeft: '1px solid var(--color-border)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.style.borderLeft = '3px solid var(--color-coral-hope)'
        el.style.backgroundColor = '#FFF8F7'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.borderLeft = '1px solid var(--color-border)'
        el.style.backgroundColor = 'var(--color-bg-primary)'
      }}
    >
      {/* Photo */}
      <div
        className="w-14 h-14 rounded-lg flex-shrink-0 overflow-hidden"
        style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
      >
        {hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.primaryImageUrl!}
            alt={`Foto de ${name}`}
            className="w-full h-full object-cover object-top"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg width="28" height="36" viewBox="0 0 28 36" fill="none" aria-hidden="true">
              <circle cx="14" cy="10" r="7" fill="#D1D5DB" />
              <path d="M0 30c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="#D1D5DB" strokeWidth="2" fill="none" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p
              className="font-semibold text-base"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
            >
              {name}
            </p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              {age != null ? `${age} anos` : ''}
              {age != null && caseData.lastSeenLocation ? ' — ' : ''}
              {caseData.lastSeenLocation ?? ''}
            </p>
          </div>
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <span
              className="px-2 py-0.5 rounded text-xs font-semibold"
              style={{ backgroundColor: source.bg, color: source.text }}
            >
              {source.label}
            </span>
            <span
              className="px-2 py-0.5 rounded text-xs font-semibold"
              style={{
                backgroundColor: caseData.status === 'active' ? 'var(--color-alert-amber-light)' : 'var(--color-bg-tertiary)',
                color: caseData.status === 'active' ? '#92400E' : 'var(--color-text-muted)',
              }}
            >
              {caseData.status === 'active' ? 'ATIVO' : caseData.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Days + actions */}
        <div className="flex items-center gap-4 mt-2">
          {days != null && (
            <p className="text-sm">
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: daysColor(days),
                }}
              >
                {days}
              </span>
              <span style={{ color: 'var(--color-text-muted)' }}> {days === 1 ? 'dia' : 'dias'}</span>
            </p>
          )}
          <Link
            href={`/case/${caseData.id}`}
            className="text-sm font-medium transition-colors flex items-center gap-1"
            style={{ color: 'var(--color-coral-hope)', fontFamily: 'var(--font-heading)' }}
          >
            Ver Caso
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  )
}

interface SearchResultsProps {
  cases: CaseSummary[]
  total: number
  isLoading?: boolean
  query?: string
}

export function SearchResults({ cases, total, isLoading, query }: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="space-y-3" aria-label="Carregando resultados" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonResultRow key={i} />
        ))}
      </div>
    )
  }

  if (!cases.length) {
    return (
      <EmptyState
        icon="search"
        title="Nenhum resultado encontrado"
        description={
          query
            ? `Nenhum resultado para "${query}". A base é atualizada a cada 30 minutos. Tente com outros termos ou registre o caso para monitoramento contínuo.`
            : 'Refine os filtros ou tente uma busca diferente.'
        }
        action={{ label: 'Registrar caso', href: '/register-case' }}
      />
    )
  }

  return (
    <div role="main" aria-label={`${total} resultados de busca`}>
      <div className="space-y-3" aria-live="polite">
        {cases.map((c) => (
          <SearchResultRow key={c.id} caseData={c} />
        ))}
      </div>
    </div>
  )
}
