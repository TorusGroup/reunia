'use client'

// =============================================================
// ReunIA — Face Comparison Component
// Side-by-side comparison: uploaded photo vs case photo
// Used in HITL validation and citizen match review
// =============================================================

import React from 'react'
import { ShieldAlert, User } from 'lucide-react'
import type { ConfidenceTier } from './face-results'

interface FaceComparisonProps {
  /** Base64 or URL of the uploaded query image */
  queryImageSrc: string
  /** URL of the matched case photo */
  matchedPhotoUrl: string | null
  matchedPersonName: string | null
  caseNumber: string
  similarity: number
  confidenceTier: ConfidenceTier
  className?: string
}

const TIER_LABELS: Record<ConfidenceTier, string> = {
  HIGH: 'Alta confiança',
  MEDIUM: 'Média confiança',
  LOW: 'Baixa confiança',
  REJECTED: 'Não relevante',
}

const TIER_COLORS: Record<ConfidenceTier, string> = {
  HIGH: '#10B981',
  MEDIUM: '#3B82F6',
  LOW: '#F59E0B',
  REJECTED: '#9CA3AF',
}

export function FaceComparison({
  queryImageSrc,
  matchedPhotoUrl,
  matchedPersonName,
  caseNumber,
  similarity,
  confidenceTier,
  className = '',
}: FaceComparisonProps) {
  const pct = Math.round(similarity * 100)
  const tierColor = TIER_COLORS[confidenceTier]

  return (
    <div className={className}>
      {/* Side-by-side photos */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        {/* Query photo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#6B7280',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Foto enviada
          </span>
          <div
            style={{
              width: '100%',
              aspectRatio: '1',
              maxWidth: '240px',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '2px solid rgba(45, 53, 97, 0.2)',
              background: '#F3F4F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={queryImageSrc}
              alt="Foto enviada para busca"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        </div>

        {/* Similarity indicator */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: `rgba(${
                confidenceTier === 'HIGH'
                  ? '16, 185, 129'
                  : confidenceTier === 'MEDIUM'
                  ? '59, 130, 246'
                  : '245, 158, 11'
              }, 0.1)`,
              border: `3px solid ${tierColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
            }}
            aria-label={`Similaridade: ${pct}%`}
          >
            <span
              style={{
                fontSize: '16px',
                fontWeight: 800,
                color: tierColor,
                lineHeight: 1,
              }}
            >
              {pct}%
            </span>
          </div>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: tierColor,
              textAlign: 'center',
              maxWidth: '64px',
            }}
          >
            {TIER_LABELS[confidenceTier]}
          </span>
        </div>

        {/* Case photo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#6B7280',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Caso {caseNumber}
          </span>
          <div
            style={{
              width: '100%',
              aspectRatio: '1',
              maxWidth: '240px',
              borderRadius: '12px',
              overflow: 'hidden',
              border: `2px solid ${tierColor}`,
              background: '#F3F4F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {matchedPhotoUrl ? (
              <img
                src={matchedPhotoUrl}
                alt={`Foto do caso ${caseNumber} — ${matchedPersonName ?? ''}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <User size={48} color="#9CA3AF" />
            )}
          </div>
          {matchedPersonName && (
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-deep-indigo, #2D3561)',
                textAlign: 'center',
              }}
            >
              {matchedPersonName}
            </p>
          )}
        </div>
      </div>

      {/* HITL reminder */}
      <div
        style={{
          marginTop: '16px',
          padding: '10px 14px',
          borderRadius: '8px',
          background: 'rgba(232, 99, 74, 0.06)',
          border: '1px solid rgba(232, 99, 74, 0.2)',
          display: 'flex',
          gap: '8px',
          fontSize: '12px',
          color: '#7C2D12',
          alignItems: 'flex-start',
        }}
        role="note"
      >
        <ShieldAlert size={14} style={{ flexShrink: 0, marginTop: '1px', color: '#E8634A' }} />
        <span>
          Esta comparação requer revisão humana antes de qualquer ação.
          A inteligência artificial auxilia, mas a decisão final é sempre de um profissional.
        </span>
      </div>
    </div>
  )
}
