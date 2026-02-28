'use client'

import { useState, useEffect, useCallback } from 'react'
import { SightingCard } from '@/components/le-dashboard/sighting-card'
import type { SightingData } from '@/components/le-dashboard/sighting-card'

// =============================================================
// Sightings Review Section — Sprint 6, E7-S04
// Wired to real API endpoints (Sprint 6 AL-03)
// =============================================================

export function SightingsReview() {
  const [sightings, setSightings] = useState<SightingData[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  const fetchSightings = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }

      const res = await fetch(`/api/v1/sightings?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      })

      if (!res.ok) {
        if (res.status === 401) {
          setError('Sessão expirada. Faça login novamente.')
          return
        }
        if (res.status === 403) {
          setError('Acesso negado. Permissão insuficiente.')
          return
        }
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      if (data.success) {
        const mapped: SightingData[] = data.data.sightings.map((s: Record<string, unknown>) => ({
          id: s.id,
          caseId: s.caseId ?? null,
          caseNumber: (s.case as Record<string, unknown> | null)?.caseNumber ?? null,
          description: s.description,
          seenAt: s.seenAt ?? null,
          locationText: s.locationText ?? null,
          latitude: s.latitude ?? null,
          longitude: s.longitude ?? null,
          photoUrl: s.photoUrl ?? null,
          status: s.status as SightingData['status'],
          isAnonymous: s.isAnonymous ?? false,
          reporterName: null,
          createdAt: s.createdAt as string,
        }))
        setSightings(mapped)
        setTotal(data.data.total ?? mapped.length)
      }
    } catch (err) {
      console.error('Failed to fetch sightings:', err)
      setError('Erro ao carregar avistamentos. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchSightings()
  }, [fetchSightings])

  const handleReview = async (id: string, status: 'confirmed' | 'rejected', reason?: string) => {
    try {
      const res = await fetch(`/api/v1/sightings/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          status,
          reviewNotes: reason ?? `Reviewed as ${status}`,
        }),
      })

      if (res.ok) {
        // Optimistic update
        setSightings((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status } : s))
        )
      } else {
        console.error('Failed to review sighting:', res.status)
      }
    } catch (err) {
      console.error('Review error:', err)
    }
  }

  const filtered = statusFilter === 'all'
    ? sightings
    : sightings.filter((s) => s.status === statusFilter)

  const pendingCount = sightings.filter((s) => s.status === 'pending' || s.status === 'reviewing').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}>
            Avistamentos
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {pendingCount} aguardando revisão &middot; {total} total
          </p>
        </div>
        <button
          onClick={fetchSightings}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          Atualizar
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{ backgroundColor: 'rgba(232, 99, 74, 0.08)', color: 'var(--color-coral-hope)' }}
        >
          {error}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'reviewing', 'confirmed', 'rejected'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 text-xs font-medium rounded-full border transition-all"
            style={{
              backgroundColor: statusFilter === s ? 'var(--color-deep-indigo)' : 'transparent',
              color: statusFilter === s ? 'white' : 'var(--color-text-secondary)',
              borderColor: statusFilter === s ? 'var(--color-deep-indigo)' : 'var(--color-border)',
            }}
          >
            {s === 'all' ? 'Todos' : s === 'pending' ? 'Pendente' : s === 'reviewing' ? 'Em revisão' : s === 'confirmed' ? 'Confirmado' : 'Rejeitado'}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div
            className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--color-deep-indigo)', borderTopColor: 'transparent' }}
          />
        </div>
      )}

      {/* Cards */}
      {!isLoading && filtered.length === 0 ? (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-primary)' }}
        >
          <p style={{ color: 'var(--color-text-muted)' }}>Nenhum avistamento neste status.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((sighting) => (
            <SightingCard
              key={sighting.id}
              sighting={sighting}
              onReview={handleReview}
              onLinkCase={(id) => console.log('Link case', id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Helper: get JWT token from cookie or localStorage
function getToken(): string {
  if (typeof window === 'undefined') return ''
  // Try cookie first (set by auth system)
  const cookies = document.cookie.split(';')
  const tokenCookie = cookies.find((c) => c.trim().startsWith('access_token='))
  if (tokenCookie) return tokenCookie.split('=')[1]?.trim() ?? ''
  // Fallback to localStorage
  return localStorage.getItem('access_token') ?? ''
}
