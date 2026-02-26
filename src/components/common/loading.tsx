// =============================================================
// Loading — Radar pulse animation + skeleton states (Sprint 4, E5)
// Used across all public pages
// =============================================================

// Radar pulse loading indicator (face match / heavy operations)
export function RadarPulseLoader({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12">
      <div className="relative w-16 h-16 flex items-center justify-center">
        {/* Pulsing rings */}
        <span
          className="absolute inset-0 rounded-full"
          style={{
            backgroundColor: 'var(--color-coral-hope)',
            opacity: 0.15,
            animation: 'radar-pulse 2s cubic-bezier(0, 0, 0.2, 1) infinite',
          }}
        />
        <span
          className="absolute inset-0 rounded-full"
          style={{
            backgroundColor: 'var(--color-coral-hope)',
            opacity: 0.15,
            animation: 'radar-pulse 2s cubic-bezier(0, 0, 0.2, 1) infinite',
            animationDelay: '1s',
          }}
        />
        {/* Center dot */}
        <span
          className="relative w-6 h-6 rounded-full"
          style={{ backgroundColor: 'var(--color-coral-hope)' }}
        />
      </div>
      <p
        className="text-sm font-medium"
        style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
      >
        {label}
      </p>
    </div>
  )
}

// Skeleton card for case grid loading state
export function SkeletonCaseCard() {
  return (
    <div
      className="rounded-xl overflow-hidden animate-pulse"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
      }}
      aria-hidden="true"
    >
      {/* Photo area */}
      <div
        className="w-full aspect-square"
        style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
      />
      {/* Content area */}
      <div className="p-4 space-y-2">
        <div
          className="h-4 rounded"
          style={{ backgroundColor: 'var(--color-bg-tertiary)', width: '70%' }}
        />
        <div
          className="h-3 rounded"
          style={{ backgroundColor: 'var(--color-bg-tertiary)', width: '50%' }}
        />
        <div
          className="h-3 rounded"
          style={{ backgroundColor: 'var(--color-bg-tertiary)', width: '60%' }}
        />
        <div className="flex justify-between pt-2">
          <div
            className="h-5 rounded-full"
            style={{ backgroundColor: 'var(--color-bg-tertiary)', width: '45%' }}
          />
          <div
            className="h-5 rounded-full"
            style={{ backgroundColor: 'var(--color-bg-tertiary)', width: '30%' }}
          />
        </div>
      </div>
    </div>
  )
}

// Skeleton result row for search page
export function SkeletonResultRow() {
  return (
    <div
      className="flex gap-4 p-4 rounded-xl animate-pulse"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border)',
      }}
      aria-hidden="true"
    >
      <div
        className="w-14 h-14 rounded-lg flex-shrink-0"
        style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
      />
      <div className="flex-1 space-y-2">
        <div
          className="h-4 rounded"
          style={{ backgroundColor: 'var(--color-bg-tertiary)', width: '40%' }}
        />
        <div
          className="h-3 rounded"
          style={{ backgroundColor: 'var(--color-bg-tertiary)', width: '60%' }}
        />
        <div className="flex gap-2">
          <div
            className="h-5 rounded-full"
            style={{ backgroundColor: 'var(--color-bg-tertiary)', width: '60px' }}
          />
          <div
            className="h-5 rounded-full"
            style={{ backgroundColor: 'var(--color-bg-tertiary)', width: '50px' }}
          />
        </div>
      </div>
    </div>
  )
}
