'use client'

import { useState } from 'react'
import { CaseManager } from '@/components/le-dashboard/case-manager'
import type { LeCaseRow } from '@/components/le-dashboard/case-manager'

// =============================================================
// Cases Management Section — Sprint 6, E7-S02
// Mock data — API integration Sprint 7+
// =============================================================

const MOCK_CASES: LeCaseRow[] = [
  { id: '1', caseNumber: 'BR-2026-001', personName: 'Ana Silva', status: 'active', urgency: 'critical', source: 'platform', lastSeenLocation: 'São Paulo, SP', reportedAt: '2026-02-20T10:00:00Z', assignedOrg: 'DECRIAD-SP' },
  { id: '2', caseNumber: 'BR-2026-018', personName: 'João Oliveira', status: 'active', urgency: 'critical', source: 'platform', lastSeenLocation: 'Rio de Janeiro, RJ', reportedAt: '2026-02-18T08:30:00Z', assignedOrg: null },
  { id: '3', caseNumber: 'BR-2026-034', personName: 'Mariana Costa', status: 'pending_review', urgency: 'high', source: 'ncmec', lastSeenLocation: 'Curitiba, PR', reportedAt: '2026-02-15T14:00:00Z', assignedOrg: null },
  { id: '4', caseNumber: 'BR-2026-052', personName: 'Lucas Ferreira', status: 'active', urgency: 'high', source: 'fbi', lastSeenLocation: 'Belo Horizonte, MG', reportedAt: '2026-02-10T09:00:00Z', assignedOrg: 'PCMG' },
  { id: '5', caseNumber: 'US-2026-091', personName: 'Emily Johnson', status: 'active', urgency: 'high', source: 'fbi', lastSeenLocation: 'Miami, FL', reportedAt: '2026-02-08T16:00:00Z', assignedOrg: null },
  { id: '6', caseNumber: 'BR-2026-007', personName: 'Pedro Santos', status: 'resolved', urgency: 'standard', source: 'platform', lastSeenLocation: 'Salvador, BA', reportedAt: '2026-01-15T11:00:00Z', assignedOrg: 'PCBA' },
  { id: '7', caseNumber: 'INT-2026-012', personName: 'Sofia Gomes', status: 'active', urgency: 'standard', source: 'interpol', lastSeenLocation: 'Lisboa, Portugal', reportedAt: '2026-02-01T07:00:00Z', assignedOrg: null },
]

export function CasesManagement() {
  const [cases, setCases] = useState<LeCaseRow[]>(MOCK_CASES)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = cases.filter((c) => {
    const matchesSearch = !search || c.personName.toLowerCase().includes(search.toLowerCase()) || c.caseNumber.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleStatusChange = (caseId: string, newStatus: LeCaseRow['status']) => {
    setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, status: newStatus } : c)))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}>
          Gestão de Casos
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          {cases.filter((c) => c.status === 'active').length} casos ativos &middot; {cases.filter((c) => c.status === 'pending_review').length} aguardando revisão
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou número..."
          className="flex-1 min-w-48 border rounded-lg px-3 py-2 text-sm"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
          }}
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="pending_review">Revisão pendente</option>
          <option value="resolved">Resolvido</option>
          <option value="closed">Encerrado</option>
        </select>
      </div>

      <CaseManager
        cases={filtered}
        onStatusChange={handleStatusChange}
        onAssign={(id) => console.log('Assign case', id)}
      />
    </div>
  )
}
