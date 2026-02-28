'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { StatsOverview } from '@/components/le-dashboard/stats-overview'
import { UrgencyBadge } from '@/components/le-dashboard/case-manager'
import type { CaseUrgency } from '@/components/le-dashboard/case-manager'

// =============================================================
// LE Dashboard Overview — Stats + urgent cases + recent matches
// Sprint 7 — LE-01: Real data from /api/v1/le/stats
// Fallback to mock data if API unavailable
// =============================================================

interface StatsData {
  activeCases: number
  pendingValidations: number
  recentMatches: number
  resolvedThisMonth: number
  recentSightings: number
  totalSightingsPending: number
}

interface UrgentCase {
  id: string
  caseNumber: string
  personName: string
  urgency: CaseUrgency
  lastSeenLocation: string | null
  hoursOpen: number
  reportedAt: string
}

// Fallback mock data
const MOCK_STATS: StatsData = {
  activeCases: 0,
  pendingValidations: 0,
  recentMatches: 0,
  resolvedThisMonth: 0,
  recentSightings: 0,
  totalSightingsPending: 0,
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token') ?? null
}

export function LeDashboardOverview() {
  const [stats, setStats] = useState<StatsData>(MOCK_STATS)
  const [urgentCases, setUrgentCases] = useState<UrgentCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const token = getAccessToken()
      const res = await fetch('/api/v1/le/stats', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const json = await res.json()
      if (json.success) {
        setStats(json.data.stats)
        setUrgentCases(json.data.urgentCases ?? [])
        setError(null)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(`Falha ao carregar dados: ${msg}`)
      // Keep existing data on error (graceful degradation)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    // Refresh stats every 60 seconds
    const interval = setInterval(fetchStats, 60_000)
    return () => clearInterval(interval)
  }, [fetchStats])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            Visao Geral
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link
          href="/le-dashboard/validation"
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white transition-all"
          style={{ backgroundColor: stats.pendingValidations > 0 ? 'var(--color-coral-hope)' : 'var(--color-deep-indigo)' }}
        >
          <span>Fila de Validacao</span>
          {stats.pendingValidations > 0 && (
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}
            >
              {stats.pendingValidations}
            </span>
          )}
        </Link>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{
            backgroundColor: 'var(--color-alert-amber-light)',
            color: 'var(--color-alert-amber-dark)',
            borderLeft: '3px solid var(--color-alert-amber)',
          }}
        >
          {error}. Dados podem estar desatualizados.
          <button
            onClick={() => { setLoading(true); fetchStats() }}
            className="ml-2 underline font-medium"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Stats cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-5 border animate-pulse"
              style={{ backgroundColor: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)', height: 100 }}
            />
          ))}
        </div>
      ) : (
        <StatsOverview
          activeCases={stats.activeCases}
          pendingValidations={stats.pendingValidations}
          recentMatches={stats.recentMatches}
          resolvedThisMonth={stats.resolvedThisMonth}
          avgResponseHours={0}
        />
      )}

      {/* Additional stats row */}
      {!loading && (
        <div className="grid grid-cols-2 gap-4">
          <div
            className="rounded-xl p-5 border"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              borderColor: 'var(--color-border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Avistamentos (24h)
            </p>
            <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-data-blue)' }}>
              {stats.recentSightings}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {stats.totalSightingsPending} pendentes de revisao
            </p>
          </div>
          <div
            className="rounded-xl p-5 border"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              borderColor: 'var(--color-border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Matches Pendentes HITL
            </p>
            <p
              className="text-3xl font-bold"
              style={{
                fontFamily: 'var(--font-mono)',
                color: stats.pendingValidations > 0 ? 'var(--color-coral-hope)' : 'var(--color-found-green)',
              }}
            >
              {stats.pendingValidations}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {stats.pendingValidations > 0 ? 'requerem revisao humana' : 'nenhum pendente'}
            </p>
          </div>
        </div>
      )}

      {/* Urgent cases */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-lg font-semibold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            Casos Urgentes
          </h2>
          <Link
            href="/le-dashboard/cases"
            className="text-sm font-medium"
            style={{ color: 'var(--color-coral-hope)' }}
          >
            Ver todos &rarr;
          </Link>
        </div>

        {urgentCases.length === 0 && !loading ? (
          <div
            className="rounded-xl border p-8 text-center"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-primary)' }}
          >
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Nenhum caso urgente no momento.
            </p>
          </div>
        ) : (
          <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                  <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: 'var(--color-text-secondary)' }}>Crianca</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: 'var(--color-text-secondary)' }}>Urgencia</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: 'var(--color-text-secondary)' }}>Ultimo local</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: 'var(--color-text-secondary)' }}>Aberto ha</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: 'var(--color-text-secondary)' }}>Acao</th>
                </tr>
              </thead>
              <tbody>
                {urgentCases.map((c, idx) => (
                  <tr
                    key={c.id}
                    className="border-t"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: idx % 2 === 0 ? 'var(--color-bg-primary)' : 'var(--color-bg-secondary)',
                    }}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{c.personName}</p>
                      <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                        #{c.caseNumber}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <UrgencyBadge urgency={c.urgency} />
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                      {c.lastSeenLocation ?? '---'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-mono"
                        style={{
                          fontFamily: 'var(--font-mono)',
                          color: c.hoursOpen < 24 ? 'var(--color-coral-hope)' : 'var(--color-text-muted)',
                          fontWeight: c.hoursOpen < 24 ? 600 : 400,
                        }}
                      >
                        {c.hoursOpen}h
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/case/${c.id}`}
                        className="text-xs px-2 py-1 rounded-md border transition-colors"
                        style={{ borderColor: 'var(--color-deep-indigo)', color: 'var(--color-deep-indigo)' }}
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
