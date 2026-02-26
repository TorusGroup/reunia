'use client'

import { useState } from 'react'
import { clsx } from 'clsx'

// =============================================================
// Case Manager — Full case CRUD with status workflow (Sprint 6)
// =============================================================

export type CaseStatus = 'draft' | 'pending_review' | 'active' | 'resolved' | 'closed' | 'archived'
export type CaseUrgency = 'critical' | 'high' | 'standard' | 'low'

export interface LeCaseRow {
  id: string
  caseNumber: string
  personName: string
  status: CaseStatus
  urgency: CaseUrgency
  source: string
  lastSeenLocation: string | null
  reportedAt: string
  assignedOrg: string | null
}

interface UrgencyBadgeProps {
  urgency: CaseUrgency
}

export function UrgencyBadge({ urgency }: UrgencyBadgeProps) {
  const labels: Record<CaseUrgency, string> = {
    critical: 'Crítico',
    high: 'Alto',
    standard: 'Padrão',
    low: 'Baixo',
  }
  return (
    <span
      className={clsx('urgency-badge text-xs font-semibold px-2 py-0.5 rounded-full border', `urgency-${urgency}`)}
    >
      {labels[urgency]}
    </span>
  )
}

interface StatusBadgeProps {
  status: CaseStatus
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config: Record<CaseStatus, { label: string; color: string; bg: string }> = {
    draft: { label: 'Rascunho', color: 'var(--color-text-muted)', bg: 'var(--color-bg-tertiary)' },
    pending_review: { label: 'Revisão', color: 'var(--color-alert-amber-dark)', bg: 'var(--color-alert-amber-light)' },
    active: { label: 'Ativo', color: 'var(--color-found-green-dark)', bg: 'var(--color-found-green-light)' },
    resolved: { label: 'Resolvido', color: 'var(--color-data-blue-dark)', bg: 'var(--color-data-blue-light)' },
    closed: { label: 'Encerrado', color: 'var(--color-text-secondary)', bg: 'var(--color-bg-tertiary)' },
    archived: { label: 'Arquivado', color: 'var(--color-text-muted)', bg: 'var(--color-bg-tertiary)' },
  }
  const c = config[status]
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ color: c.color, backgroundColor: c.bg }}
    >
      {c.label}
    </span>
  )
}

interface CaseManagerProps {
  cases: LeCaseRow[]
  onStatusChange?: (caseId: string, newStatus: CaseStatus) => void
  onAssign?: (caseId: string) => void
}

export function CaseManager({ cases, onStatusChange, onAssign }: CaseManagerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'date' | 'urgency' | 'status'>('urgency')

  const sorted = [...cases].sort((a, b) => {
    if (sortBy === 'urgency') {
      const urgencyOrder: Record<CaseUrgency, number> = { critical: 0, high: 1, standard: 2, low: 3 }
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    }
    if (sortBy === 'date') return new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()
    return a.status.localeCompare(b.status)
  })

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedIds(next)
  }

  const toggleAll = () => {
    setSelectedIds(selectedIds.size === cases.length ? new Set() : new Set(cases.map((c) => c.id)))
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <span className="text-sm font-medium" style={{ color: 'var(--color-coral-hope)' }}>
              {selectedIds.size} selecionado(s)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Ordenar por:
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="text-sm border rounded-lg px-2 py-1.5"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
            }}
          >
            <option value="urgency">Urgência</option>
            <option value="date">Data</option>
            <option value="status">Status</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === cases.length && cases.length > 0}
                    onChange={toggleAll}
                    className="rounded"
                    aria-label="Selecionar todos"
                  />
                </th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Caso</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Urgência</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Localização</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Data</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, idx) => (
                <tr
                  key={c.id}
                  className="border-t transition-colors"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: selectedIds.has(c.id)
                      ? 'rgba(232, 99, 74, 0.04)'
                      : idx % 2 === 0
                      ? 'var(--color-bg-primary)'
                      : 'var(--color-bg-secondary)',
                  }}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      {c.personName}
                    </p>
                    <p
                      className="text-xs"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
                    >
                      #{c.caseNumber}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <UrgencyBadge urgency={c.urgency} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {c.lastSeenLocation ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
                    >
                      {new Date(c.reportedAt).toLocaleDateString('pt-BR')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onAssign?.(c.id)}
                        className="text-xs px-2 py-1 rounded-md border transition-colors"
                        style={{
                          borderColor: 'var(--color-deep-indigo)',
                          color: 'var(--color-deep-indigo)',
                          backgroundColor: 'transparent',
                        }}
                      >
                        Atribuir
                      </button>
                      {c.status === 'pending_review' && (
                        <button
                          onClick={() => onStatusChange?.(c.id, 'active')}
                          className="text-xs px-2 py-1 rounded-md transition-colors text-white"
                          style={{ backgroundColor: 'var(--color-found-green)' }}
                        >
                          Ativar
                        </button>
                      )}
                      {c.status === 'active' && (
                        <button
                          onClick={() => onStatusChange?.(c.id, 'resolved')}
                          className="text-xs px-2 py-1 rounded-md transition-colors text-white"
                          style={{ backgroundColor: 'var(--color-data-blue)' }}
                        >
                          Resolver
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {cases.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center" style={{ color: 'var(--color-text-muted)' }}>
                    Nenhum caso encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
