// =============================================================
// Global Loading State (E8-S04 — Sprint 7)
// Brand animation — radar pulse with Coral Hope color
// =============================================================

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Carregando..."
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-soft-cream, #FFF8F0)',
        fontFamily: 'var(--font-jakarta, "Plus Jakarta Sans", sans-serif)',
      }}
    >
      {/* Radar pulse animation */}
      <div
        aria-hidden="true"
        style={{
          position: 'relative',
          width: '80px',
          height: '80px',
          marginBottom: '1.5rem',
        }}
      >
        {/* Outer pulse rings */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2px solid var(--color-coral-hope, #E8634A)',
            opacity: 0,
            animation: 'radarPulse 2s ease-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: '10px',
            borderRadius: '50%',
            border: '2px solid var(--color-coral-hope, #E8634A)',
            opacity: 0,
            animation: 'radarPulse 2s ease-out infinite 0.4s',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: '20px',
            borderRadius: '50%',
            border: '2px solid var(--color-coral-hope, #E8634A)',
            opacity: 0,
            animation: 'radarPulse 2s ease-out infinite 0.8s',
          }}
        />

        {/* Center dot */}
        <div
          style={{
            position: 'absolute',
            inset: '30px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-coral-hope, #E8634A)',
          }}
        />
      </div>

      {/* Brand name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <span
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--color-deep-indigo, #2D3561)',
          }}
        >
          Reun
        </span>
        <span
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--color-coral-hope, #E8634A)',
          }}
        >
          IA
        </span>
      </div>

      <p
        style={{
          marginTop: '0.5rem',
          fontSize: '0.875rem',
          color: '#6B7280',
        }}
      >
        Carregando...
      </p>

      {/* Animation keyframes */}
      <style>{`
        @keyframes radarPulse {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
