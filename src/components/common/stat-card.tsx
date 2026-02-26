// =============================================================
// StatCard — KPI card with large number (Sprint 4, E5)
// Used in homepage stats banner and dashboard
// =============================================================

interface StatCardProps {
  value: string | number
  label: string
  sublabel?: string
  mono?: boolean
}

export function StatCard({ value, label, sublabel, mono = true }: StatCardProps) {
  return (
    <div className="text-center">
      <p
        className="text-4xl font-bold text-white leading-none"
        style={{ fontFamily: mono ? 'var(--font-mono)' : 'var(--font-heading)' }}
        aria-live="polite"
        role="meter"
      >
        {value}
      </p>
      <p
        className="mt-2 text-sm font-medium uppercase tracking-wide"
        style={{ color: 'rgba(255,255,255,0.7)' }}
      >
        {label}
      </p>
      {sublabel && (
        <p className="mt-0.5 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {sublabel}
        </p>
      )}
    </div>
  )
}
