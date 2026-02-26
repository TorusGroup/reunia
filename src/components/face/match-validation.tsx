'use client'

// =============================================================
// ReunIA — Match Validation Component (HITL UI)
// Law enforcement interface for confirming/rejecting face matches
// NON-NEGOTIABLE: families never notified without this step
// =============================================================

import React, { useState } from 'react'
import { Check, X, AlertTriangle, ChevronRight, Clock, AlertCircle } from 'lucide-react'
import { FaceComparison } from './face-comparison'
import type { ConfidenceTier } from './face-results'

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export interface PendingMatch {
  id: string
  similarity: number
  confidenceTier: ConfidenceTier
  querySource: string
  requestedAt: string
  caseNumber: string
  caseStatus: string
  personName: string | null
  personAge: number | null
  primaryPhotoUrl: string | null
  queryImageUrl?: string
}

interface MatchValidationProps {
  match: PendingMatch
  queryImageSrc?: string
  onConfirm: (matchId: string, notes?: string, durationSeconds?: number) => Promise<void>
  onReject: (matchId: string, notes: string, durationSeconds?: number) => Promise<void>
  onEscalate: (matchId: string, notes?: string) => Promise<void>
  isSubmitting?: boolean
  className?: string
}

// ---------------------------------------------------------------
// Component
// ---------------------------------------------------------------

export function MatchValidation({
  match,
  queryImageSrc,
  onConfirm,
  onReject,
  onEscalate,
  isSubmitting = false,
  className = '',
}: MatchValidationProps) {
  const [notes, setNotes] = useState('')
  const [action, setAction] = useState<'confirm' | 'reject' | 'escalate' | null>(null)
  const [startTime] = useState(Date.now())
  const [showCognitiveWarning, setShowCognitiveWarning] = useState(false)

  // Show cognitive fatigue warning after reviewing many matches
  React.useEffect(() => {
    const timer = setTimeout(() => setShowCognitiveWarning(true), 15 * 60 * 1000) // 15 min
    return () => clearTimeout(timer)
  }, [])

  const waitingMs = Date.now() - new Date(match.requestedAt).getTime()
  const waitingMinutes = Math.floor(waitingMs / 60000)

  const handleAction = async (selectedAction: 'confirm' | 'reject' | 'escalate') => {
    if (selectedAction === 'reject' && !notes.trim()) {
      setAction('reject') // Show notes requirement
      return
    }

    const durationSeconds = Math.floor((Date.now() - startTime) / 1000)

    if (selectedAction === 'confirm') {
      await onConfirm(match.id, notes.trim() || undefined, durationSeconds)
    } else if (selectedAction === 'reject') {
      await onReject(match.id, notes.trim(), durationSeconds)
    } else {
      await onEscalate(match.id, notes.trim() || undefined)
    }
  }

  return (
    <div
      className={className}
      style={{
        background: 'var(--color-soft-cream, #FFF8F0)',
        borderRadius: '16px',
        border: '1px solid rgba(45, 53, 97, 0.12)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          background: 'var(--color-deep-indigo, #2D3561)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 700 }}>
            Revisão de Correspondência
          </h3>
          <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
            Caso {match.caseNumber}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Clock size={13} color="rgba(255,255,255,0.6)" />
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
            Aguardando há {waitingMinutes}min
          </span>
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        {/* Cognitive fatigue warning */}
        {showCognitiveWarning && (
          <div
            role="alert"
            style={{
              marginBottom: '16px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              gap: '8px',
              fontSize: '12px',
              color: '#78350F',
              alignItems: 'flex-start',
            }}
          >
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>
              Você está revisando há mais de 15 minutos. Considere fazer uma pausa para manter
              a precisão das revisões.
            </span>
          </div>
        )}

        {/* Face comparison */}
        {queryImageSrc ? (
          <FaceComparison
            queryImageSrc={queryImageSrc}
            matchedPhotoUrl={match.primaryPhotoUrl}
            matchedPersonName={match.personName}
            caseNumber={match.caseNumber}
            similarity={match.similarity}
            confidenceTier={match.confidenceTier}
          />
        ) : (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              background: '#F3F4F6',
              borderRadius: '12px',
              color: '#6B7280',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            Imagem de consulta não disponível para visualização
          </div>
        )}

        {/* Person details */}
        <div
          style={{
            marginTop: '16px',
            padding: '14px',
            borderRadius: '10px',
            background: 'rgba(45, 53, 97, 0.04)',
            border: '1px solid rgba(45, 53, 97, 0.08)',
          }}
        >
          <dl
            style={{
              margin: 0,
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '6px 16px',
              fontSize: '13px',
            }}
          >
            <dt style={{ color: '#6B7280', fontWeight: 500 }}>Nome:</dt>
            <dd style={{ margin: 0, fontWeight: 600, color: '#111827' }}>
              {match.personName ?? 'Não disponível'}
            </dd>
            <dt style={{ color: '#6B7280', fontWeight: 500 }}>Idade:</dt>
            <dd style={{ margin: 0, color: '#111827' }}>
              {match.personAge !== null ? `${match.personAge} anos` : 'Não disponível'}
            </dd>
            <dt style={{ color: '#6B7280', fontWeight: 500 }}>Caso:</dt>
            <dd style={{ margin: 0, fontFamily: 'monospace', color: '#111827' }}>
              {match.caseNumber}
            </dd>
            <dt style={{ color: '#6B7280', fontWeight: 500 }}>Origem:</dt>
            <dd style={{ margin: 0, color: '#111827' }}>{match.querySource}</dd>
          </dl>
        </div>

        {/* Notes */}
        <div style={{ marginTop: '16px' }}>
          <label
            htmlFor={`notes-${match.id}`}
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-deep-indigo, #2D3561)',
              marginBottom: '6px',
            }}
          >
            Observações{' '}
            {action === 'reject' && (
              <span style={{ color: '#E8634A' }}>
                *
              </span>
            )}
            {action !== 'reject' && (
              <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(opcional)</span>
            )}
          </label>
          <textarea
            id={`notes-${match.id}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              action === 'reject'
                ? 'Obrigatório: explique o motivo da rejeição'
                : 'Adicione observações para o registro...'
            }
            rows={3}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: `1px solid ${action === 'reject' && !notes.trim() ? '#E8634A' : 'rgba(45, 53, 97, 0.2)'}`,
              fontSize: '13px',
              resize: 'vertical',
              fontFamily: 'inherit',
              background: '#fff',
              outline: 'none',
            }}
            aria-required={action === 'reject'}
            aria-invalid={action === 'reject' && !notes.trim()}
          />
          {action === 'reject' && !notes.trim() && (
            <p
              role="alert"
              style={{ margin: '4px 0 0', fontSize: '12px', color: '#E8634A' }}
            >
              Observações obrigatórias para rejeição
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div
          style={{
            marginTop: '20px',
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          {/* Confirm */}
          <button
            onClick={() => handleAction('confirm')}
            disabled={isSubmitting}
            style={{
              flex: 1,
              minWidth: '120px',
              padding: '12px 16px',
              borderRadius: '10px',
              border: 'none',
              background: '#10B981',
              color: '#fff',
              fontWeight: 700,
              fontSize: '14px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              opacity: isSubmitting ? 0.6 : 1,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting)
                (e.currentTarget as HTMLButtonElement).style.background = '#059669'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background = '#10B981'
            }}
            aria-label="Confirmar correspondência"
          >
            <Check size={16} />
            Confirmar
          </button>

          {/* Reject */}
          <button
            onClick={() => {
              setAction('reject')
              if (notes.trim()) handleAction('reject')
            }}
            disabled={isSubmitting}
            style={{
              flex: 1,
              minWidth: '120px',
              padding: '12px 16px',
              borderRadius: '10px',
              border: '2px solid rgba(232, 99, 74, 0.3)',
              background: 'rgba(232, 99, 74, 0.08)',
              color: '#C2410C',
              fontWeight: 700,
              fontSize: '14px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              opacity: isSubmitting ? 0.6 : 1,
              transition: 'background 0.2s',
            }}
            aria-label="Rejeitar correspondência"
          >
            <X size={16} />
            Rejeitar
          </button>

          {/* Escalate */}
          <button
            onClick={() => handleAction('escalate')}
            disabled={isSubmitting}
            style={{
              flexShrink: 0,
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid rgba(45, 53, 97, 0.2)',
              background: '#fff',
              color: 'var(--color-deep-indigo, #2D3561)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              opacity: isSubmitting ? 0.6 : 1,
            }}
            aria-label="Escalar para revisão adicional"
            title="Escalar para revisão adicional"
          >
            <AlertCircle size={14} />
            Escalar
            <ChevronRight size={14} />
          </button>
        </div>

        {/* CVV reminder */}
        <p
          style={{
            margin: '16px 0 0',
            fontSize: '11px',
            color: '#9CA3AF',
            textAlign: 'center',
          }}
        >
          Em caso de crise emocional durante o trabalho:{' '}
          <strong style={{ color: 'var(--color-coral-hope, #E8634A)' }}>CVV 188</strong>{' '}
          (24h, gratuito)
        </p>
      </div>
    </div>
  )
}
