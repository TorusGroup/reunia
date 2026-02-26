'use client'

// =============================================================
// Analytics Charts — Mock chart components (Sprint 6)
// Data is hardcoded — real integration in Sprint 7+
// Bar, line, pie placeholders
// =============================================================

interface BarChartProps {
  title: string
  data: { label: string; value: number; color?: string }[]
  unit?: string
}

export function MockBarChart({ title, data, unit = '' }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <h3
        className="font-semibold text-sm mb-4"
        style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-heading)' }}
      >
        {title}
      </h3>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.label}>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: 'var(--color-text-secondary)' }}>{item.label}</span>
              <span
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}
              >
                {item.value}{unit}
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(item.value / max) * 100}%`,
                  backgroundColor: item.color ?? 'var(--color-deep-indigo)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface LineChartProps {
  title: string
  data: { label: string; value: number }[]
  unit?: string
}

export function MockLineChart({ title, data, unit = '' }: LineChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const height = 80

  // Simple SVG polyline
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 280
    const y = height - (d.value / max) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <h3
        className="font-semibold text-sm mb-4"
        style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-heading)' }}
      >
        {title}
      </h3>
      <svg width="100%" viewBox={`0 0 280 ${height}`} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke="var(--color-coral-hope)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * 280
          const y = height - (d.value / max) * height
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              fill="var(--color-coral-hope)"
            />
          )
        })}
      </svg>
      <div className="flex justify-between text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
        {data.map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}

interface BiasMetricsTableProps {
  data: {
    skinTone: string
    truePositiveRate: number
    falsePositiveRate: number
    sampleSize: number
  }[]
}

export function BiasMetricsTable({ data }: BiasMetricsTableProps) {
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Métricas de Bias por Tom de Pele (Fitzpatrick)
        </h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Monitoramento de equidade algorítmica
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
            <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Tom de Pele
            </th>
            <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              TPR
            </th>
            <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              FPR
            </th>
            <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Amostras
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => {
            const isHighFpr = row.falsePositiveRate > 0.15
            return (
              <tr
                key={row.skinTone}
                className="border-t"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {row.skinTone}
                </td>
                <td className="px-4 py-3" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-found-green-dark)' }}>
                  {(row.truePositiveRate * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3">
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: isHighFpr ? 'var(--color-coral-hope)' : 'var(--color-text-secondary)',
                      fontWeight: isHighFpr ? 600 : 400,
                    }}
                  >
                    {(row.falsePositiveRate * 100).toFixed(1)}%
                    {isHighFpr && ' ⚠'}
                  </span>
                </td>
                <td
                  className="px-4 py-3 text-xs"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
                >
                  {row.sampleSize.toLocaleString()}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
