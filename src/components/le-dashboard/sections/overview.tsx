'use client'

import Link from 'next/link'
import { StatsOverview } from '@/components/le-dashboard/stats-overview'
import { UrgencyBadge } from '@/components/le-dashboard/case-manager'
import type { CaseUrgency } from '@/components/le-dashboard/case-manager'

// =============================================================
// LE Dashboard Overview — Stats + urgent cases + recent matches
// Sprint 6, E7-S02 — all mock data (API real in Sprint 7+)
// =============================================================

// Mock data — all hardcoded per sprint spec
const MOCK_STATS = {
  activeCases: 142,
  pendingValidations: 7,
  recentMatches: 3,
  resolvedThisMonth: 12,
  avgResponseHours: 4,
}

interface UrgentCase {
  id: string
  caseNumber: string
  personName: string
  urgency: CaseUrgency
  lastSeen: string
  hoursOpen: number
}

const MOCK_URGENT: UrgentCase[] = [
  { id: '1', caseNumber: 'BR-2026-001', personName: 'Ana Silva', urgency: 'critical', lastSeen: 'São Paulo, SP', hoursOpen: 6 },
  { id: '2', caseNumber: 'BR-2026-018', personName: 'João Oliveira', urgency: 'critical', lastSeen: 'Rio de Janeiro, RJ', hoursOpen: 14 },
  { id: '3', caseNumber: 'BR-2026-034', personName: 'Mariana Costa', urgency: 'high', lastSeen: 'Curitiba, PR', hoursOpen: 28 },
  { id: '4', caseNumber: 'BR-2026-052', personName: 'Lucas Ferreira', urgency: 'high', lastSeen: 'Belo Horizonte, MG', hoursOpen: 48 },
  { id: '5', caseNumber: 'US-2026-091', personName: 'Emily Johnson', urgency: 'high', lastSeen: 'Miami, FL', hoursOpen: 72 },
]

export function LeDashboardOverview() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            Visão Geral
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link
          href="/le-dashboard/validation"
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white transition-all"
          style={{ backgroundColor: MOCK_STATS.pendingValidations > 0 ? 'var(--color-coral-hope)' : 'var(--color-deep-indigo)' }}
        >
          <span>Fila de Validação</span>
          {MOCK_STATS.pendingValidations > 0 && (
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}
            >
              {MOCK_STATS.pendingValidations}
            </span>
          )}
        </Link>
      </div>

      {/* Stats cards */}
      <StatsOverview {...MOCK_STATS} />

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
            Ver todos →
          </Link>
        </div>

        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: 'var(--color-text-secondary)' }}>Criança</th>
                <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: 'var(--color-text-secondary)' }}>Urgência</th>
                <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: 'var(--color-text-secondary)' }}>Último local</th>
                <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: 'var(--color-text-secondary)' }}>Aberto há</th>
                <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: 'var(--color-text-secondary)' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_URGENT.map((c, idx) => (
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
                    {c.lastSeen}
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
                      href={`/le-dashboard/cases`}
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
      </div>
    </div>
  )
}
