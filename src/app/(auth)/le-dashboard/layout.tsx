import type { Metadata } from 'next'
import { LeSidebar } from '@/components/le-dashboard/le-sidebar'

// =============================================================
// LE Dashboard Layout — Sprint 6, E7-S01
// Requires law_enforcement or admin role
// Desktop-first: fixed sidebar + main content
// =============================================================

export const metadata: Metadata = {
  title: 'Painel — ReunIA Law Enforcement',
  description: 'Painel exclusivo para forças policiais e autoridades.',
  robots: { index: false, follow: false },
}

export default function LeDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="flex min-h-screen"
      style={{ backgroundColor: 'var(--color-bg-secondary)' }}
    >
      {/* Fixed sidebar — 256px wide on desktop */}
      <LeSidebar />

      {/* Main content area */}
      <div className="flex-1 ml-0 lg:ml-64 min-h-screen">
        <main id="main-content" className="p-6">
          {children}
        </main>

        {/* Footer with CVV 188 — NON-NEGOTIABLE */}
        <footer
          className="px-6 py-4 text-center text-xs border-t"
          style={{
            color: 'var(--color-text-muted)',
            borderColor: 'var(--color-border)',
          }}
        >
          ReunIA — Plataforma para busca de crianças desaparecidas &nbsp;|&nbsp;
          <strong style={{ color: 'var(--color-coral-hope)' }}>CVV 188</strong> (apoio emocional 24h) &nbsp;|&nbsp;
          Disque Denúncia <strong>181</strong> &nbsp;|&nbsp;
          Emergência <strong>190</strong>
        </footer>
      </div>
    </div>
  )
}
