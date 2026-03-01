import type { Metadata } from 'next'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { GeoAlertsDashboard } from '@/components/alerts/geo-alerts-dashboard'

// =============================================================
// Geo-Alerts Page — Alert feed + subscription
// Feature 2: Geo-Alert System
// =============================================================

export const metadata: Metadata = {
  title: 'Alertas Geolocalizados — ReunIA',
  description: 'Veja alertas recentes de desaparecimentos e inscreva-se para receber notificacoes na sua regiao.',
  robots: { index: true, follow: true },
}

export default function GeoAlertsPage() {
  return (
    <>
      <Header />
      <main
        id="main-content"
        className="min-h-screen py-8 px-4"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1
              className="text-3xl font-bold mb-2"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
            >
              Alertas Geolocalizados
            </h1>
            <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
              Monitore desaparecimentos em tempo real. Inscreva-se para receber alertas na sua regiao.
            </p>
          </div>

          <GeoAlertsDashboard />
        </div>
      </main>
      <Footer />
    </>
  )
}
