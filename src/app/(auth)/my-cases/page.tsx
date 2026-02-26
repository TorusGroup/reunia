import type { Metadata } from 'next'

// =============================================================
// My Cases Page — Auth Route Group (placeholder)
// Full implementation in Sprint 4 (E5)
// =============================================================

export const metadata: Metadata = {
  title: 'Meus Casos',
  robots: { index: false, follow: false },
}

export default function MyCasesPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen p-6"
      style={{ backgroundColor: 'var(--color-bg-secondary)' }}
    >
      <h1
        className="text-2xl font-bold mb-4"
        style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
      >
        Meus Casos
      </h1>
      <p style={{ color: 'var(--color-text-secondary)' }}>
        Gerenciamento de casos em desenvolvimento. Sprint 4.
      </p>
    </main>
  )
}
