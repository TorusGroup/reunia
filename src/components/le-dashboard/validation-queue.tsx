'use client'

import { useState } from 'react'
import Image from 'next/image'

// =============================================================
// Validation Queue — HITL Match Review (Sprint 6, E7-S03)
// Side-by-side comparison: 240x240px equal-sized images
// NON-NEGOTIABLE: Human-in-the-loop, ethical reminder, reject reason required
// =============================================================

export type ConfidenceTier = 'possible' | 'likely' | 'confident' | 'very_confident'

export interface MatchForReview {
  id: string
  queryImageUrl: string
  matchedImageUrl: string
  similarityScore: number
  confidenceTier: ConfidenceTier
  matchedPersonName: string
  matchedCaseNumber: string
  requestedAt: string
  estimatedAge: number | null
  skinToneCategory: string | null
}

interface ValidationQueueProps {
  matches: MatchForReview[]
  onApprove: (matchId: string, notes?: string) => Promise<void>
  onReject: (matchId: string, reason: string) => Promise<void>
  onEscalate: (matchId: string) => Promise<void>
}

const CONFIDENCE_LABELS: Record<ConfidenceTier, { label: string; color: string }> = {
  possible: { label: 'Possível', color: 'var(--color-text-muted)' },
  likely: { label: 'Provável', color: 'var(--color-alert-amber)' },
  confident: { label: 'Confiante', color: 'var(--color-found-green)' },
  very_confident: { label: 'Muito Confiante', color: 'var(--color-data-blue)' },
}

const REJECT_REASONS = [
  'Idades muito diferentes',
  'Características físicas divergentes',
  'Imagem de baixa qualidade',
  'Pessoa diferente — sem semelhança',
  'Imagem duplicada / já revisada',
  'Outro motivo',
]

function MatchCard({
  match,
  onApprove,
  onReject,
  onEscalate,
}: {
  match: MatchForReview
  onApprove: (matchId: string, notes?: string) => Promise<void>
  onReject: (matchId: string, reason: string) => Promise<void>
  onEscalate: (matchId: string) => Promise<void>
}) {
  const [notes, setNotes] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [reviewStart] = useState(Date.now())

  const confidence = CONFIDENCE_LABELS[match.confidenceTier]
  const scorePercent = Math.round(match.similarityScore * 100)

  const handleApprove = async () => {
    setIsLoading(true)
    try {
      await onApprove(match.id, notes || undefined)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason) return
    setIsLoading(true)
    try {
      await onReject(match.id, rejectReason)
    } finally {
      setIsLoading(false)
      setShowRejectForm(false)
    }
  }

  const elapsedSeconds = Math.round((Date.now() - reviewStart) / 1000)
  const showFatigueWarning = elapsedSeconds > 120

  return (
    <div
      className="rounded-xl border p-6"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* ETHICAL REMINDER — NON-NEGOTIABLE */}
      <div
        className="mb-4 p-3 rounded-lg text-sm"
        style={{
          backgroundColor: 'var(--color-data-blue-light)',
          color: 'var(--color-data-blue-dark)',
          borderLeft: '3px solid var(--color-data-blue)',
        }}
      >
        <strong>Lembrete ético:</strong> Esta decisão afeta uma família real. Avalie com cuidado.
        Uma rejeição incorreta pode atrasar o resgate. Uma aprovação incorreta pode causar trauma.
      </div>

      {showFatigueWarning && (
        <div
          className="mb-4 p-3 rounded-lg text-sm"
          style={{
            backgroundColor: 'var(--color-alert-amber-light)',
            color: 'var(--color-alert-amber-dark)',
          }}
        >
          Você está revisando há mais de 2 minutos. Considere uma pausa para manter o foco.
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {match.matchedPersonName}
          </h3>
          <p
            className="text-xs"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
          >
            Caso #{match.matchedCaseNumber}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold" style={{ color: confidence.color }}>
            {confidence.label}
          </p>
          <p
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-deep-indigo)' }}
          >
            {scorePercent}%
          </p>
        </div>
      </div>

      {/* Similarity bar */}
      <div className="mb-4">
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${scorePercent}%`,
              backgroundColor:
                scorePercent >= 80
                  ? 'var(--color-found-green)'
                  : scorePercent >= 60
                  ? 'var(--color-alert-amber)'
                  : 'var(--color-coral-hope)',
            }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          <span>0%</span>
          <span>Similaridade: {scorePercent}%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Side-by-side images — 240x240px equal size */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs font-medium mb-2 text-center" style={{ color: 'var(--color-text-secondary)' }}>
            Imagem de busca
          </p>
          <div
            className="relative rounded-lg overflow-hidden"
            style={{ width: 240, height: 240, maxWidth: '100%' }}
          >
            <Image
              src={match.queryImageUrl}
              alt="Imagem de busca"
              fill
              className="object-cover"
              sizes="240px"
            />
          </div>
        </div>
        <div>
          <p className="text-xs font-medium mb-2 text-center" style={{ color: 'var(--color-text-secondary)' }}>
            Correspondência encontrada
          </p>
          <div
            className="relative rounded-lg overflow-hidden"
            style={{ width: 240, height: 240, maxWidth: '100%' }}
          >
            <Image
              src={match.matchedImageUrl}
              alt="Correspondência"
              fill
              className="object-cover"
              sizes="240px"
            />
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
        {match.estimatedAge && (
          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>Idade estimada: </span>
            <span style={{ color: 'var(--color-text-primary)' }}>{match.estimatedAge} anos</span>
          </div>
        )}
        {match.skinToneCategory && (
          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>Tom de pele: </span>
            <span style={{ color: 'var(--color-text-primary)' }}>Fitzpatrick {match.skinToneCategory}</span>
          </div>
        )}
      </div>

      {/* Notes input */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas opcionais para aprovação..."
        rows={2}
        className="w-full text-sm border rounded-lg px-3 py-2 mb-4 resize-none"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-bg-secondary)',
          color: 'var(--color-text-primary)',
        }}
      />

      {/* Reject form */}
      {showRejectForm && (
        <div
          className="mb-4 p-4 rounded-lg border"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}
        >
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Motivo da rejeição (obrigatório):
          </p>
          <select
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 mb-3"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
            }}
          >
            <option value="">— Selecione um motivo —</option>
            {REJECT_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={!rejectReason || isLoading}
              className="flex-1 py-2 text-sm font-semibold rounded-lg text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-warm-gray)' }}
            >
              Confirmar Rejeição
            </button>
            <button
              onClick={() => setShowRejectForm(false)}
              className="px-4 py-2 text-sm rounded-lg border"
              style={{ borderColor: 'var(--color-border)' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!showRejectForm && (
        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            disabled={isLoading}
            className="flex-1 py-2.5 text-sm font-semibold rounded-lg text-white transition-all disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-found-green)' }}
          >
            Confirmar Correspondência
          </button>
          <button
            onClick={() => setShowRejectForm(true)}
            disabled={isLoading}
            className="flex-1 py-2.5 text-sm font-semibold rounded-lg border transition-all disabled:opacity-50"
            style={{
              borderColor: 'var(--color-warm-gray)',
              color: 'var(--color-warm-gray)',
              backgroundColor: 'transparent',
            }}
          >
            Rejeitar
          </button>
          <button
            onClick={() => onEscalate(match.id)}
            disabled={isLoading}
            className="px-4 py-2.5 text-sm font-semibold rounded-lg border transition-all disabled:opacity-50"
            style={{
              borderColor: 'var(--color-data-blue)',
              color: 'var(--color-data-blue)',
              backgroundColor: 'transparent',
            }}
            title="Escalar para supervisor"
          >
            Escalar
          </button>
        </div>
      )}
    </div>
  )
}

export function ValidationQueue({
  matches,
  onApprove,
  onReject,
  onEscalate,
}: ValidationQueueProps) {
  if (matches.length === 0) {
    return (
      <div
        className="rounded-xl border p-12 text-center"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-primary)' }}
      >
        <p className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
          Fila vazia
        </p>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Não há correspondências aguardando validação.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {matches.map((match) => (
        <MatchCard
          key={match.id}
          match={match}
          onApprove={onApprove}
          onReject={onReject}
          onEscalate={onEscalate}
        />
      ))}
    </div>
  )
}
