'use client'

import { useState } from 'react'
import { ValidationQueue } from '@/components/le-dashboard/validation-queue'
import type { MatchForReview } from '@/components/le-dashboard/validation-queue'

// =============================================================
// Match Validation Section — HITL queue (Sprint 6, E7-S03)
// Mock data — API integration Sprint 7+
// =============================================================

const MOCK_MATCHES: MatchForReview[] = [
  {
    id: 'm1',
    queryImageUrl: 'https://placehold.co/240x240/E8634A/white?text=Query',
    matchedImageUrl: 'https://placehold.co/240x240/2D3561/white?text=Match',
    similarityScore: 0.847,
    confidenceTier: 'confident',
    matchedPersonName: 'Ana Silva',
    matchedCaseNumber: 'BR-2026-001',
    requestedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    estimatedAge: 8,
    skinToneCategory: 'III',
  },
  {
    id: 'm2',
    queryImageUrl: 'https://placehold.co/240x240/7BA098/white?text=Query',
    matchedImageUrl: 'https://placehold.co/240x240/2D3561/white?text=Match',
    similarityScore: 0.623,
    confidenceTier: 'likely',
    matchedPersonName: 'João Oliveira',
    matchedCaseNumber: 'BR-2026-018',
    requestedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    estimatedAge: 12,
    skinToneCategory: 'IV',
  },
  {
    id: 'm3',
    queryImageUrl: 'https://placehold.co/240x240/F59E0B/white?text=Query',
    matchedImageUrl: 'https://placehold.co/240x240/2D3561/white?text=Match',
    similarityScore: 0.412,
    confidenceTier: 'possible',
    matchedPersonName: 'Mariana Costa',
    matchedCaseNumber: 'BR-2026-034',
    requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    estimatedAge: 10,
    skinToneCategory: 'II',
  },
]

export function MatchValidation() {
  const [matches, setMatches] = useState<MatchForReview[]>(MOCK_MATCHES)
  const [completed, setCompleted] = useState<{ id: string; action: string }[]>([])

  const handleApprove = async (matchId: string, notes?: string) => {
    setMatches((prev) => prev.filter((m) => m.id !== matchId))
    setCompleted((prev) => [...prev, { id: matchId, action: 'aprovado' }])
    console.log('Approve match', matchId, notes)
  }

  const handleReject = async (matchId: string, reason: string) => {
    setMatches((prev) => prev.filter((m) => m.id !== matchId))
    setCompleted((prev) => [...prev, { id: matchId, action: 'rejeitado' }])
    console.log('Reject match', matchId, reason)
  }

  const handleEscalate = async (matchId: string) => {
    setMatches((prev) => prev.filter((m) => m.id !== matchId))
    setCompleted((prev) => [...prev, { id: matchId, action: 'escalado' }])
    console.log('Escalate match', matchId)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}>
            Validação de Correspondências (HITL)
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {matches.length} aguardando revisão &middot; {completed.length} concluídas nesta sessão
          </p>
        </div>
      </div>

      {/* Completed summary */}
      {completed.length > 0 && (
        <div
          className="flex flex-wrap gap-2 p-3 rounded-lg text-sm"
          style={{ backgroundColor: 'var(--color-found-green-light)' }}
        >
          <span style={{ color: 'var(--color-found-green-dark)' }}>
            Sessão atual: {completed.map((c) => c.action).join(', ')}
          </span>
        </div>
      )}

      <ValidationQueue
        matches={matches}
        onApprove={handleApprove}
        onReject={handleReject}
        onEscalate={handleEscalate}
      />
    </div>
  )
}
