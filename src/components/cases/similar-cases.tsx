'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { AvatarPlaceholder } from '@/components/common/avatar-placeholder'

// =============================================================
// SimilarCases — Shows cases with similar patterns
// Feature 3: Similarity Engine
// =============================================================

interface SimilarCase {
  id: string
  caseNumber: string
  personName: string
  approximateAge: number | null
  lastSeenLocation: string | null
  lastSeenCountry: string | null
  reportedAt: string
  source: string
  primaryImageUrl: string | null
  similarityScore: number
  matchReasons: string[]
}

interface SimilarCasesProps {
  caseId: string
}

const SOURCE_LABELS: Record<string, string> = {
  fbi: 'FBI',
  ncmec: 'NCMEC',
  interpol: 'Interpol',
  amber: 'AMBER',
  platform: 'ReunIA',
  opensanctions: 'OpenSanctions',
}

function SimilarCaseImage({ src, name }: { src: string | null; name: string }) {
  const [broken, setBroken] = useState(false)
  const handleError = useCallback(() => setBroken(true), [])

  if (!src || broken) {
    return <AvatarPlaceholder name={name} size="full" className="rounded-lg" />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/v1/proxy-image?url=${encodeURIComponent(src)}`}
      alt={name}
      className="w-full h-full object-cover"
      loading="lazy"
      onError={handleError}
    />
  )
}

export function SimilarCases({ caseId }: SimilarCasesProps) {
  const [cases, setCases] = useState<SimilarCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSimilar() {
      try {
        const res = await fetch(`/api/v1/cases/${caseId}/similar`)
        const json = await res.json()
        if (json.success) {
          setCases(json.data)
        } else {
          setError(json.error?.message ?? 'Erro ao buscar casos similares')
        }
      } catch {
        setError('Erro de conexão')
      } finally {
        setLoading(false)
      }
    }
    fetchSimilar()
  }, [caseId])

  if (loading) {
    return (
      <div className="p-6 text-center">
        <span className="inline-block w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-coral-hope)', borderTopColor: 'transparent' }} />
        <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>Buscando casos similares...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>
      </div>
    )
  }

  if (cases.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Nenhum caso similar encontrado no momento.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {cases.map((c) => (
        <Link
          key={c.id}
          href={`/case/${c.id}`}
          className="flex items-start gap-3 p-3 rounded-lg transition-colors"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          {/* Image */}
          <div
            className="w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
          >
            <SimilarCaseImage src={c.primaryImageUrl} name={c.personName} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-deep-indigo)', fontFamily: 'var(--font-heading)' }}>
                {c.personName}
              </p>
              <span
                className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: c.similarityScore >= 60 ? 'var(--color-coral-hope-light)' : 'var(--color-bg-tertiary)',
                  color: c.similarityScore >= 60 ? 'var(--color-coral-hope-dark)' : 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                }}
              >
                {c.similarityScore}% similar
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {c.approximateAge ? `${c.approximateAge} anos` : ''}
              {c.approximateAge && c.lastSeenLocation ? ' · ' : ''}
              {c.lastSeenLocation ?? ''}
              {' · '}
              {SOURCE_LABELS[c.source] ?? c.source}
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {c.matchReasons.slice(0, 3).map((reason, i) => (
                <span
                  key={i}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: 'var(--color-data-blue-light)',
                    color: 'var(--color-data-blue-dark)',
                    fontSize: '0.6rem',
                  }}
                >
                  {reason}
                </span>
              ))}
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
