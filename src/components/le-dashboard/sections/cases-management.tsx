'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { CaseManager } from '@/components/le-dashboard/case-manager'
import type { LeCaseRow } from '@/components/le-dashboard/case-manager'

// =============================================================
// Cases Management Section — Sprint 7, LE-01
// Real data from /api/v1/le/cases API
// =============================================================

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token') ?? null
}

export function CasesManagement() {
  const [cases, setCases] = useState<LeCaseRow[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchCases = useCallback(async () => {
    try {
      const token = getAccessToken()
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sortBy: 'reportedAt',
        sortOrder: 'desc',
      })
      if (search) params.set('search', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const res = await fetch(`/api/v1/le/cases?${params.toString()}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const json = await res.json()
      if (json.success) {
        const apiCases: LeCaseRow[] = json.data.cases.map((c: Record<string, unknown>) => ({
          id: c.id as string,
          caseNumber: c.caseNumber as string,
          personName: c.personName as string,
          status: c.status as LeCaseRow['status'],
          urgency: c.urgency as LeCaseRow['urgency'],
          source: c.source as string,
          lastSeenLocation: c.lastSeenLocation as string | null,
          reportedAt: c.reportedAt as string,
          assignedOrg: (c.assignedOrg as Record<string, unknown> | null)?.name as string ?? null,
        }))
        setCases(apiCases)
        setTotal(json.data.total as number)
        setTotalPages(json.data.totalPages as number)
        setError(null)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(`Falha ao carregar casos: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => {
    setLoading(true)
    fetchCases()
  }, [fetchCases])

  // Debounce search
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const handleStatusChange = (caseId: string, newStatus: LeCaseRow['status']) => {
    // Optimistic update — API call would go here in production
    setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, status: newStatus } : c)))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}>
          Gestao de Casos
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          {loading ? 'Carregando...' : `${total} casos encontrados`}
        </p>
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

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por nome, numero do caso ou local..."
          className="flex-1 min-w-48 border rounded-lg px-3 py-2 text-sm"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="border rounded-lg px-3 py-2 text-sm"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
          }}
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="pending_review">Revisao pendente</option>
          <option value="resolved">Resolvido</option>
          <option value="closed">Encerrado</option>
          <option value="archived">Arquivado</option>
        </select>
      </div>

      {/* Loading */}
      {loading ? (
        <div
          className="rounded-xl border p-12 text-center animate-pulse"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-tertiary)' }}
        >
          <p style={{ color: 'var(--color-text-muted)' }}>Carregando casos...</p>
        </div>
      ) : (
        <>
          <CaseManager
            cases={cases}
            onStatusChange={handleStatusChange}
            onAssign={(id) => {
              // Navigate to case detail for assignment
              window.location.href = `/case/${id}`
            }}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Pagina {page} de {totalPages} ({total} casos)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all disabled:opacity-40"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all disabled:opacity-40"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                >
                  Proxima
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Links to case details */}
      {!loading && cases.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Clique em &quot;Atribuir&quot; para ver o detalhe completo do caso.
        </p>
      )}
    </div>
  )
}
