'use client'

// =============================================================
// Stats Overview — Key metrics cards (Sprint 6, E7-S02)
// JetBrains Mono for numbers, design tokens for colors
// =============================================================

interface StatCardProps {
  label: string
  value: string | number
  sublabel?: string
  accent?: 'coral' | 'green' | 'amber' | 'blue' | 'indigo'
}

function StatCard({ label, value, sublabel, accent = 'indigo' }: StatCardProps) {
  const accentColors: Record<string, string> = {
    coral: 'var(--color-coral-hope)',
    green: 'var(--color-found-green)',
    amber: 'var(--color-alert-amber)',
    blue: 'var(--color-data-blue)',
    indigo: 'var(--color-deep-indigo)',
  }

  return (
    <div
      className="rounded-xl p-5 border"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <p
        className="text-xs font-medium uppercase tracking-wider mb-2"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </p>
      <p
        className="text-3xl font-bold"
        style={{
          fontFamily: 'var(--font-mono)',
          color: accentColors[accent],
        }}
      >
        {value}
      </p>
      {sublabel && (
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          {sublabel}
        </p>
      )}
    </div>
  )
}

interface StatsOverviewProps {
  activeCases: number
  pendingValidations: number
  recentMatches: number
  resolvedThisMonth: number
  avgResponseHours: number
}

export function StatsOverview({
  activeCases,
  pendingValidations,
  recentMatches,
  resolvedThisMonth,
  avgResponseHours,
}: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <StatCard
        label="Casos Ativos"
        value={activeCases}
        sublabel="requerem atenção"
        accent="indigo"
      />
      <StatCard
        label="Validações Pendentes"
        value={pendingValidations}
        sublabel="aguardando revisão HITL"
        accent="amber"
      />
      <StatCard
        label="Correspondências Recentes"
        value={recentMatches}
        sublabel="últimas 24h"
        accent="coral"
      />
      <StatCard
        label="Resolvidos este mês"
        value={resolvedThisMonth}
        sublabel="crianças encontradas"
        accent="green"
      />
      <StatCard
        label="Tempo Médio de Resposta"
        value={`${avgResponseHours}h`}
        sublabel="alerta → resposta"
        accent="blue"
      />
    </div>
  )
}
