'use client'

// =============================================================
// ReunIA — Face Results Component
// Match results display: photo grid with similarity badges
// NO raw biometric data — similarity scores and metadata only
// =============================================================

import React from 'react'
import { AlertCircle, Clock, ShieldCheck, User } from 'lucide-react'

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export type ConfidenceTier = 'HIGH' | 'MEDIUM' | 'LOW' | 'REJECTED'

export interface FaceMatchResult {
  face_embedding_id: string
  person_id: string
  case_id: string
  similarity: number
  confidence_tier: ConfidenceTier
  person_name: string | null
  case_number: string
  primary_photo_url: string | null
}

interface FaceResultsProps {
  matches: FaceMatchResult[]
  matchCount: number
  faceConfidence: number | null
  faceQuality: number | null
  hitlQueued: number
  processingMs: number
  isLoading?: boolean
  onSelectMatch?: (match: FaceMatchResult) => void
  className?: string
}

// ---------------------------------------------------------------
// Confidence badge config
// ---------------------------------------------------------------

const TIER_CONFIG: Record<
  ConfidenceTier,
  { label: string; bg: string; text: string; border: string }
> = {
  HIGH: {
    label: 'Alta confiança',
    bg: 'rgba(16, 185, 129, 0.1)',
    text: '#065F46',
    border: '#6EE7B7',
  },
  MEDIUM: {
    label: 'Média confiança',
    bg: 'rgba(59, 130, 246, 0.1)',
    text: '#1E3A5F',
    border: '#93C5FD',
  },
  LOW: {
    label: 'Baixa confiança',
    bg: 'rgba(245, 158, 11, 0.1)',
    text: '#78350F',
    border: '#FCD34D',
  },
  REJECTED: {
    label: 'Não relevante',
    bg: '#F3F4F6',
    text: '#6B7280',
    border: '#D1D5DB',
  },
}

// ---------------------------------------------------------------
// Components
// ---------------------------------------------------------------

function ConfidenceBadge({ tier }: { tier: ConfidenceTier }) {
  const config = TIER_CONFIG[tier]
  const similarityLabel =
    tier === 'HIGH' ? '≥85%' : tier === 'MEDIUM' ? '70-84%' : '55-69%'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '9999px',
        background: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
        fontSize: '11px',
        fontWeight: 600,
      }}
    >
      {tier === 'HIGH' && <ShieldCheck size={10} />}
      {config.label} ({similarityLabel})
    </span>
  )
}

function SimilarityBar({ similarity }: { similarity: number }) {
  const pct = Math.round(similarity * 100)
  const barColor =
    similarity >= 0.85
      ? '#10B981'
      : similarity >= 0.70
      ? '#3B82F6'
      : '#F59E0B'

  return (
    <div style={{ marginTop: '6px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#6B7280',
          marginBottom: '3px',
        }}
      >
        <span>Similaridade</span>
        <span style={{ fontWeight: 700, color: barColor }}>{pct}%</span>
      </div>
      <div
        style={{
          height: '6px',
          borderRadius: '3px',
          background: '#E5E7EB',
          overflow: 'hidden',
        }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Similaridade: ${pct}%`}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: barColor,
            borderRadius: '3px',
            transition: 'width 0.6s ease',
          }}
        />
      </div>
    </div>
  )
}

function MatchCard({
  match,
  onSelect,
}: {
  match: FaceMatchResult
  onSelect?: (m: FaceMatchResult) => void
}) {
  return (
    <article
      onClick={() => onSelect?.(match)}
      role={onSelect ? 'button' : 'article'}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={(e) => {
        if (onSelect && (e.key === 'Enter' || e.key === ' ')) onSelect(match)
      }}
      aria-label={`Resultado: ${match.person_name ?? 'Nome não disponível'}, Caso ${match.case_number}`}
      style={{
        padding: '16px',
        border: '1px solid rgba(45, 53, 97, 0.12)',
        borderRadius: '12px',
        background: 'var(--color-soft-cream, #FFF8F0)',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s, transform 0.1s',
        display: 'flex',
        gap: '14px',
      }}
      onMouseEnter={(e) => {
        if (onSelect) {
          ;(e.currentTarget as HTMLElement).style.boxShadow =
            '0 4px 16px rgba(45, 53, 97, 0.15)'
          ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
        }
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
        ;(e.currentTarget as HTMLElement).style.transform = 'none'
      }}
    >
      {/* Photo */}
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '8px',
          overflow: 'hidden',
          flexShrink: 0,
          background: '#E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {match.primary_photo_url ? (
          <img
            src={match.primary_photo_url}
            alt={`Foto de ${match.person_name ?? 'pessoa'}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        ) : (
          <User size={32} color="#9CA3AF" />
        )}
      </div>

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <p
            style={{
              margin: 0,
              fontWeight: 600,
              color: 'var(--color-deep-indigo, #2D3561)',
              fontSize: '15px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {match.person_name ?? 'Nome não disponível'}
          </p>
          <ConfidenceBadge tier={match.confidence_tier} />
        </div>

        <p style={{ margin: '4px 0', fontSize: '12px', color: '#6B7280' }}>
          Caso: <strong style={{ fontFamily: 'monospace', color: '#374151' }}>{match.case_number}</strong>
        </p>

        <SimilarityBar similarity={match.similarity} />
      </div>
    </article>
  )
}

// ---------------------------------------------------------------
// Main component
// ---------------------------------------------------------------

export function FaceResults({
  matches,
  matchCount,
  faceConfidence,
  faceQuality,
  hitlQueued,
  processingMs,
  isLoading = false,
  onSelectMatch,
  className = '',
}: FaceResultsProps) {
  if (isLoading) {
    return (
      <div
        className={className}
        style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
        aria-busy="true"
        aria-live="polite"
      >
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            style={{
              height: '112px',
              borderRadius: '12px',
              background: 'linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
            }}
          />
        ))}
        <style>{`
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* HITL notice — always visible */}
      <div
        role="status"
        style={{
          padding: '12px 16px',
          borderRadius: '10px',
          background: 'rgba(45, 53, 97, 0.05)',
          border: '1px solid rgba(45, 53, 97, 0.12)',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start',
          fontSize: '13px',
          color: '#374151',
        }}
      >
        <Clock size={16} style={{ flexShrink: 0, marginTop: '1px', color: 'var(--color-sage, #7BA098)' }} />
        <span>
          <strong>{hitlQueued} resultado(s)</strong> aguardam revisão humana antes de qualquer
          notificação às famílias.{' '}
          <span style={{ color: 'var(--color-coral-hope, #E8634A)', fontWeight: 600 }}>
            CVV 188 (24h, gratuito)
          </span>
        </span>
      </div>

      {/* Stats */}
      {(faceConfidence !== null || processingMs > 0) && (
        <div
          style={{
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            fontSize: '12px',
            color: '#6B7280',
          }}
        >
          {faceConfidence !== null && (
            <span>
              Confiança de detecção:{' '}
              <strong style={{ color: '#374151' }}>{Math.round(faceConfidence * 100)}%</strong>
            </span>
          )}
          {faceQuality !== null && (
            <span>
              Qualidade da imagem:{' '}
              <strong style={{ color: '#374151' }}>{Math.round((faceQuality ?? 0) * 100)}%</strong>
            </span>
          )}
          <span>
            Processado em: <strong style={{ color: '#374151' }}>{processingMs}ms</strong>
          </span>
        </div>
      )}

      {/* Results list */}
      {matchCount === 0 ? (
        <div
          style={{
            padding: '32px 24px',
            textAlign: 'center',
            borderRadius: '12px',
            background: 'var(--color-soft-cream, #FFF8F0)',
            border: '1px solid rgba(45, 53, 97, 0.08)',
          }}
          role="status"
        >
          <AlertCircle
            size={40}
            color="var(--color-sage, #7BA098)"
            style={{ margin: '0 auto 12px' }}
          />
          <p
            style={{
              margin: 0,
              fontWeight: 600,
              color: 'var(--color-deep-indigo, #2D3561)',
              fontSize: '16px',
            }}
          >
            Nenhuma correspondência encontrada
          </p>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#6B7280' }}>
            Isso não significa que a pessoa não está no sistema. Novos casos são adicionados
            continuamente. Considere registrar um avistamento.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3
            style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--color-deep-indigo, #2D3561)',
            }}
          >
            {matchCount} resultado{matchCount !== 1 ? 's' : ''} encontrado{matchCount !== 1 ? 's' : ''}
          </h3>
          {matches.map((match) => (
            <MatchCard
              key={match.face_embedding_id}
              match={match}
              onSelect={onSelectMatch}
            />
          ))}
        </div>
      )}
    </div>
  )
}
