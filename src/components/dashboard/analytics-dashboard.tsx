'use client'

import { useState, useEffect } from 'react'

// =============================================================
// AnalyticsDashboard — Interactive analytics with CSS-based charts
// Feature 4: No external chart library needed
// =============================================================

interface AnalyticsData {
  overview: {
    totalActiveCases: number
    totalResolvedCases: number
    totalSightings: number
    totalAlertsSent: number
    casesWithPhotos: number
  }
  byCountry: Array<{ countryCode: string; count: number }>
  bySource: Array<{ source: string; count: number }>
  byMonth: Array<{ month: string; count: number }>
  byAgeGroup: Array<{ group: string; count: number }>
  byGender: Array<{ gender: string; count: number }>
  byCaseType: Array<{ caseType: string; count: number }>
  lastUpdated: string
}

const SOURCE_LABELS: Record<string, string> = {
  fbi: 'FBI',
  ncmec: 'NCMEC',
  interpol: 'Interpol',
  amber: 'AMBER Alert',
  platform: 'ReunIA',
  opensanctions: 'OpenSanctions',
  disque100: 'Disque 100',
  cnpd: 'CNPD',
  gdelt: 'GDELT',
  namus: 'NamUs',
  scraper: 'Scraper',
  other: 'Outros',
}

const GENDER_LABELS: Record<string, string> = {
  male: 'Masculino',
  female: 'Feminino',
  other: 'Outro',
  unknown: 'Nao informado',
}

const CASE_TYPE_LABELS: Record<string, string> = {
  missing: 'Desaparecido',
  abduction_family: 'Abducao familiar',
  abduction_nonfamily: 'Abducao nao-familiar',
  runaway: 'Fuga',
  lost: 'Perdido',
  trafficking_suspected: 'Trafico suspeito',
  unidentified: 'Nao identificado',
  other: 'Outro',
}

const BAR_COLORS = [
  'var(--color-coral-hope)',
  'var(--color-deep-indigo)',
  'var(--color-data-blue)',
  'var(--color-found-green)',
  'var(--color-alert-amber)',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
]

function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR')
}

function StatBox({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'var(--color-deep-indigo)' }}
        >
          {icon}
        </div>
        <div>
          <p
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-deep-indigo)' }}
          >
            {value}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {label}
          </p>
        </div>
      </div>
    </div>
  )
}

function BarChart({ data, labelFn, title }: { data: Array<{ key: string; value: number }>; labelFn: (key: string) => string; title: string }) {
  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <h3
        className="text-sm font-semibold mb-4"
        style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
      >
        {title}
      </h3>
      <div className="space-y-2.5">
        {data.map((item, i) => (
          <div key={item.key}>
            <div className="flex justify-between mb-1">
              <span className="text-xs truncate max-w-[60%]" style={{ color: 'var(--color-text-secondary)' }}>
                {labelFn(item.key)}
              </span>
              <span
                className="text-xs font-bold"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-deep-indigo)' }}
              >
                {formatNumber(item.value)}
              </span>
            </div>
            <div
              className="h-3 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(item.value / max) * 100}%`,
                  backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                  minWidth: item.value > 0 ? '4px' : '0',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PieChart({ data, labelFn, title }: { data: Array<{ key: string; value: number }>; labelFn: (key: string) => string; title: string }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) return null

  // Generate conic gradient
  let accumulated = 0
  const segments = data.map((item, i) => {
    const start = accumulated
    const percent = (item.value / total) * 100
    accumulated += percent
    return {
      ...item,
      start,
      end: accumulated,
      color: BAR_COLORS[i % BAR_COLORS.length],
    }
  })

  const gradient = segments
    .map((s) => `${s.color} ${s.start}% ${s.end}%`)
    .join(', ')

  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <h3
        className="text-sm font-semibold mb-4"
        style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
      >
        {title}
      </h3>
      <div className="flex items-center gap-6">
        <div
          className="w-32 h-32 rounded-full flex-shrink-0"
          style={{
            background: `conic-gradient(${gradient})`,
          }}
        />
        <div className="space-y-1.5 min-w-0">
          {segments.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                {labelFn(s.key)}
              </span>
              <span
                className="text-xs font-bold ml-auto flex-shrink-0"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-deep-indigo)' }}
              >
                {((s.value / total) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch('/api/v1/analytics')
        const json = await res.json()
        if (json.success) {
          setData(json.data)
        } else {
          setError(json.error?.message ?? 'Erro ao carregar dados')
        }
      } catch {
        setError('Erro de conexao')
      } finally {
        setLoading(false)
      }
    }
    fetchAnalytics()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <span
            className="inline-block w-8 h-8 border-3 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--color-coral-hope)', borderTopColor: 'transparent', borderWidth: '3px' }}
          />
          <p className="text-sm mt-3" style={{ color: 'var(--color-text-muted)' }}>
            Carregando dados analiticos...
          </p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div
        className="text-center py-12 px-6 rounded-xl"
        style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }}
      >
        <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
          {error ?? 'Nenhum dado disponivel'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatBox
          value={formatNumber(data.overview.totalActiveCases)}
          label="Casos ativos"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
          }
        />
        <StatBox
          value={formatNumber(data.overview.totalResolvedCases)}
          label="Casos resolvidos"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <StatBox
          value={formatNumber(data.overview.totalSightings)}
          label="Avistamentos"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          }
        />
        <StatBox
          value={formatNumber(data.overview.totalAlertsSent)}
          label="Alertas enviados"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          }
        />
        <StatBox
          value={formatNumber(data.overview.casesWithPhotos)}
          label="Com foto"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          }
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid md:grid-cols-2 gap-6">
        <BarChart
          title="Casos por Fonte de Dados"
          data={data.bySource.map((s) => ({ key: s.source, value: s.count }))}
          labelFn={(k) => SOURCE_LABELS[k] ?? k}
        />
        <PieChart
          title="Distribuicao por Genero"
          data={data.byGender.map((g) => ({ key: g.gender, value: g.count }))}
          labelFn={(k) => GENDER_LABELS[k] ?? k}
        />
      </div>

      {/* Charts row 2 */}
      <div className="grid md:grid-cols-2 gap-6">
        <BarChart
          title="Casos por Faixa Etaria"
          data={data.byAgeGroup.map((a) => ({ key: a.group, value: a.count }))}
          labelFn={(k) => k === 'Desconhecida' ? k : `${k} anos`}
        />
        <BarChart
          title="Tipo de Caso"
          data={data.byCaseType.map((t) => ({ key: t.caseType, value: t.count }))}
          labelFn={(k) => CASE_TYPE_LABELS[k] ?? k}
        />
      </div>

      {/* Charts row 3 */}
      <div className="grid md:grid-cols-2 gap-6">
        <BarChart
          title="Casos por Pais"
          data={data.byCountry.slice(0, 10).map((c) => ({ key: c.countryCode, value: c.count }))}
          labelFn={(k) => k}
        />
        {data.byMonth.length > 0 && (
          <div
            className="rounded-xl p-5"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <h3
              className="text-sm font-semibold mb-4"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
            >
              Timeline — Casos por Mes (ultimos 12 meses)
            </h3>
            <div className="flex items-end gap-1 h-32">
              {data.byMonth.map((m, i) => {
                const max = Math.max(...data.byMonth.map((x) => x.count), 1)
                const height = (m.count / max) * 100
                return (
                  <div
                    key={m.month}
                    className="flex-1 flex flex-col items-center justify-end gap-1"
                  >
                    <span
                      className="text-xs font-bold"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-deep-indigo)', fontSize: '0.55rem' }}
                    >
                      {m.count}
                    </span>
                    <div
                      className="w-full rounded-t-sm transition-all"
                      style={{
                        height: `${Math.max(height, 2)}%`,
                        backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                        opacity: 0.85,
                        minHeight: '2px',
                      }}
                    />
                    <span
                      className="text-xs"
                      style={{ color: 'var(--color-text-muted)', fontSize: '0.5rem' }}
                    >
                      {m.month.split('-')[1]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-4">
        <p className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
          Ultima atualizacao: {new Date(data.lastUpdated).toLocaleString('pt-BR')}
          {' · '}
          Dados agregados e anonimizados — nenhuma PII exposta
        </p>
      </div>
    </div>
  )
}
