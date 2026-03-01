import type { Metadata } from 'next'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { AnalyticsDashboard } from '@/components/dashboard/analytics-dashboard'

// =============================================================
// Analytics Page — Public Dashboard
// Feature 4: Interactive Dashboard
// =============================================================

export const metadata: Metadata = {
  title: 'Painel Analitico — ReunIA',
  description: 'Visualize estatisticas de casos de criancas desaparecidas. Dados agregados e anonimizados por regiao, fonte, idade e genero.',
  robots: { index: true, follow: true },
}

export default function AnalyticsPage() {
  return (
    <>
      <Header />
      <main
        id="main-content"
        className="min-h-screen py-8 px-4"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        <div className="max-w-7xl mx-auto">
          {/* Hero */}
          <div className="mb-8">
            <h1
              className="text-3xl font-bold mb-2"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
            >
              Painel Analitico
            </h1>
            <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
              Dados agregados e anonimizados sobre casos de criancas desaparecidas.
              Nenhuma informacao pessoal identificavel e exibida.
            </p>
          </div>

          <AnalyticsDashboard />
        </div>
      </main>
      <Footer />
    </>
  )
}
