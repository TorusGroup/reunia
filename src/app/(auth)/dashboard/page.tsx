import type { Metadata } from 'next'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { FamilyDashboard } from '@/components/dashboard/family-dashboard'

// =============================================================
// Family Dashboard — Auth Route Group (Sprint 4, E5-S06)
// Meus casos + avistamentos recentes + notificacoes
// =============================================================

export const metadata: Metadata = {
  title: 'Minha Área — ReunIA',
  description: 'Acompanhe seus casos registrados, avistamentos recebidos e notificações.',
  robots: { index: false, follow: false },
}

export default function DashboardPage() {
  return (
    <>
      <Header />
      <main
        id="main-content"
        className="min-h-screen py-8 px-4"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        <div className="max-w-5xl mx-auto">
          <FamilyDashboard />
        </div>
      </main>
      <Footer />
    </>
  )
}
