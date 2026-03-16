import type { Metadata } from 'next'

// =============================================================
// Admin Panel — Admin Route Group (placeholder)
// Full implementation in Sprint 6 (E7) + Sprint 7 (E8)
// =============================================================

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
}

export default function AdminPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen p-6"
      style={{ backgroundColor: 'var(--color-deep-indigo)', minHeight: '100vh' }}
    >
      <h1
        className="text-2xl font-bold mb-4"
        style={{ fontFamily: 'var(--font-heading)', color: 'white' }}
      >
        Admin Panel
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.6)' }}>
        Dashboard administrativo em desenvolvimento. Sprint 6–7.
      </p>
    </main>
  )
}
