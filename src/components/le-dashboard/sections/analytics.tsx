'use client'

import { MockBarChart, MockLineChart, BiasMetricsTable } from '@/components/le-dashboard/analytics-charts'

// =============================================================
// Analytics Section — Sprint 6, E7-S05
// All mock data — real charts integration Sprint 7+
// =============================================================

const CASES_BY_REGION = [
  { label: 'São Paulo', value: 47, color: 'var(--color-coral-hope)' },
  { label: 'Rio de Janeiro', value: 31, color: 'var(--color-deep-indigo)' },
  { label: 'Minas Gerais', value: 18, color: 'var(--color-alert-amber)' },
  { label: 'Bahia', value: 15, color: 'var(--color-found-green)' },
  { label: 'Paraná', value: 12, color: 'var(--color-data-blue)' },
  { label: 'Outros', value: 19, color: 'var(--color-text-muted)' },
]

const RESOLUTION_TREND = [
  { label: 'Set', value: 8 },
  { label: 'Out', value: 11 },
  { label: 'Nov', value: 9 },
  { label: 'Dez', value: 14 },
  { label: 'Jan', value: 10 },
  { label: 'Fev', value: 12 },
]

const RESPONSE_TIMES = [
  { label: '< 2h', value: 34 },
  { label: '2-6h', value: 28 },
  { label: '6-24h', value: 22 },
  { label: '24-48h', value: 11 },
  { label: '> 48h', value: 5 },
]

const BIAS_METRICS = [
  { skinTone: 'I (Muito claro)', truePositiveRate: 0.97, falsePositiveRate: 0.04, sampleSize: 1240 },
  { skinTone: 'II (Claro)', truePositiveRate: 0.96, falsePositiveRate: 0.05, sampleSize: 2180 },
  { skinTone: 'III (Médio-claro)', truePositiveRate: 0.94, falsePositiveRate: 0.07, sampleSize: 3450 },
  { skinTone: 'IV (Médio-escuro)', truePositiveRate: 0.91, falsePositiveRate: 0.12, sampleSize: 2890 },
  { skinTone: 'V (Escuro)', truePositiveRate: 0.88, falsePositiveRate: 0.16, sampleSize: 1560 },
  { skinTone: 'VI (Muito escuro)', truePositiveRate: 0.85, falsePositiveRate: 0.19, sampleSize: 820 },
]

export function LeDashboardAnalytics() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}>
          Analytics
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Dados mock — integração real com PostgreSQL em Sprint 7+
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Taxa de Resolução', value: '8.4%', sub: 'este mês' },
          { label: 'Precisão Face Match', value: '83.7%', sub: 'aprovações HITL' },
          { label: 'Alertas Enviados', value: '1.247', sub: 'este mês' },
          { label: 'Tempo médio resolução', value: '11.2 dias', sub: 'média móvel 6 meses' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border p-4"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              borderColor: 'var(--color-border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
              {kpi.label}
            </p>
            <p
              className="text-2xl font-bold"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-deep-indigo)' }}
            >
              {kpi.value}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MockBarChart
          title="Casos por Região (Ativos)"
          data={CASES_BY_REGION}
        />
        <MockLineChart
          title="Crianças Encontradas por Mês"
          data={RESOLUTION_TREND}
          unit=" casos"
        />
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MockBarChart
          title="Distribuição Tempo de Resposta"
          data={RESPONSE_TIMES}
          unit="%"
        />
        <div
          className="rounded-xl border p-5"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            borderColor: 'var(--color-border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-heading)' }}>
            Fontes de Dados — Última Atualização
          </h3>
          <div className="space-y-2">
            {[
              { name: 'FBI Wanted', status: 'healthy', lastFetch: '2h atrás', records: '12.4K' },
              { name: 'Interpol', status: 'healthy', lastFetch: '3h atrás', records: '8.1K' },
              { name: 'NCMEC', status: 'healthy', lastFetch: '1h atrás', records: '31.2K' },
              { name: 'AMBER RSS', status: 'healthy', lastFetch: '15min atrás', records: '847' },
              { name: 'OpenSanctions', status: 'degraded', lastFetch: '8h atrás', records: '2.3K' },
            ].map((src) => (
              <div key={src.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: src.status === 'healthy' ? 'var(--color-found-green)' : 'var(--color-alert-amber)',
                    }}
                  />
                  <span style={{ color: 'var(--color-text-primary)' }}>{src.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                    {src.records} registros &middot; {src.lastFetch}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bias metrics — NON-NEGOTIABLE for ethical AI */}
      <BiasMetricsTable data={BIAS_METRICS} />
    </div>
  )
}
