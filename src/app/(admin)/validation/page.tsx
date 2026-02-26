import type { Metadata } from 'next'

// =============================================================
// HITL Validation Queue — Admin/LE Route Group (placeholder)
// Full implementation in Sprint 6 (E7-S03)
// =============================================================

export const metadata: Metadata = {
  title: 'Fila de Validação — HITL',
  robots: { index: false, follow: false },
}

export default function ValidationPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen p-6"
      style={{ backgroundColor: 'var(--color-deep-indigo)' }}
    >
      <h1
        className="text-2xl font-bold mb-4"
        style={{ fontFamily: 'var(--font-heading)', color: 'white' }}
      >
        Fila de Validação — HITL
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.6)' }}>
        Human-in-the-loop review queue em desenvolvimento. Sprint 6.
      </p>
      <p
        className="mt-4 p-3 rounded-lg text-sm"
        style={{
          backgroundColor: 'rgba(232,99,74,0.15)',
          color: 'var(--color-coral-hope)',
          border: '1px solid var(--color-coral-hope)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        NON-NEGOTIABLE: Toda correspondência facial DEVE ser revisada por humano antes de qualquer ação.
      </p>
    </main>
  )
}
