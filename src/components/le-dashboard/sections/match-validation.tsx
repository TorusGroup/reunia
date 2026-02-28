'use client'

import { useState, useEffect, useCallback } from 'react'
import { ValidationQueue } from '@/components/le-dashboard/validation-queue'
import type { MatchForReview } from '@/components/le-dashboard/validation-queue'

// =============================================================
// Match Validation Section — HITL queue (Sprint 7)
// Real data from /api/v1/le/reviews API
// =============================================================

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token') ?? null
}

export function MatchValidation() {
  const [matches, setMatches] = useState<MatchForReview[]>([])
  const [completed, setCompleted] = useState<{ id: string; action: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMatches = useCallback(async () => {
    try {
      const token = getAccessToken()
      const res = await fetch('/api/v1/le/reviews?status=pending&limit=50', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const json = await res.json()
      if (json.success) {
        const apiMatches: MatchForReview[] = json.data.matches.map((m: Record<string, unknown>) => ({
          id: m.id as string,
          queryImageUrl: (m.queryImageUrl as string) ?? 'https://placehold.co/240x240/6B7280/white?text=N/A',
          matchedImageUrl: (m.matchedPerson as Record<string, unknown> | null)?.imageUrl as string ?? 'https://placehold.co/240x240/2D3561/white?text=N/A',
          similarityScore: m.similarityScore as number,
          confidenceTier: m.confidenceTier as MatchForReview['confidenceTier'],
          matchedPersonName: (m.matchedPerson as Record<string, unknown> | null)?.name as string ?? 'Desconhecido',
          matchedCaseNumber: (m.matchedCase as Record<string, unknown> | null)?.caseNumber as string ?? '---',
          requestedAt: m.requestedAt as string,
          estimatedAge: (m.matchedPerson as Record<string, unknown> | null)?.approximateAge as number | null ?? null,
          skinToneCategory: null,
        }))

        setMatches(apiMatches)
        setError(null)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(`Falha ao carregar fila: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  const handleApprove = async (matchId: string, notes?: string) => {
    try {
      const token = getAccessToken()
      const res = await fetch(`/api/v1/le/reviews/${matchId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ decision: 'confirmed', notes }),
      })

      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Erro ao aprovar')

      setMatches((prev) => prev.filter((m) => m.id !== matchId))
      setCompleted((prev) => [...prev, { id: matchId, action: 'aprovado' }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown'
      alert(`Erro ao aprovar match: ${msg}`)
    }
  }

  const handleReject = async (matchId: string, reason: string) => {
    try {
      const token = getAccessToken()
      const res = await fetch(`/api/v1/le/reviews/${matchId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ decision: 'rejected', notes: reason }),
      })

      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Erro ao rejeitar')

      setMatches((prev) => prev.filter((m) => m.id !== matchId))
      setCompleted((prev) => [...prev, { id: matchId, action: 'rejeitado' }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown'
      alert(`Erro ao rejeitar match: ${msg}`)
    }
  }

  const handleEscalate = async (matchId: string) => {
    try {
      const token = getAccessToken()
      const res = await fetch(`/api/v1/le/reviews/${matchId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ decision: 'escalated', notes: 'Escalado para supervisor' }),
      })

      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Erro ao escalar')

      setMatches((prev) => prev.filter((m) => m.id !== matchId))
      setCompleted((prev) => [...prev, { id: matchId, action: 'escalado' }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown'
      alert(`Erro ao escalar match: ${msg}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}>
            Validacao de Correspondencias (HITL)
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {loading
              ? 'Carregando...'
              : `${matches.length} aguardando revisao \u00b7 ${completed.length} concluidas nesta sessao`
            }
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchMatches() }}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all"
          style={{
            borderColor: 'var(--color-deep-indigo)',
            color: 'var(--color-deep-indigo)',
          }}
        >
          Atualizar
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{
            backgroundColor: 'var(--color-alert-amber-light)',
            color: 'var(--color-alert-amber-dark)',
            borderLeft: '3px solid var(--color-alert-amber)',
          }}
        >
          {error}
        </div>
      )}

      {/* Completed summary */}
      {completed.length > 0 && (
        <div
          className="flex flex-wrap gap-2 p-3 rounded-lg text-sm"
          style={{ backgroundColor: 'var(--color-found-green-light)' }}
        >
          <span style={{ color: 'var(--color-found-green-dark)' }}>
            Sessao atual: {completed.map((c) => c.action).join(', ')}
          </span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border p-6 animate-pulse"
              style={{ backgroundColor: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)', height: 400 }}
            />
          ))}
        </div>
      ) : (
        <ValidationQueue
          matches={matches}
          onApprove={handleApprove}
          onReject={handleReject}
          onEscalate={handleEscalate}
        />
      )}
    </div>
  )
}
