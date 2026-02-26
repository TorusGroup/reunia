import type { Metadata } from 'next'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { SightingForm } from '@/components/sightings/sighting-form'

// =============================================================
// Public Sighting Report Page (Sprint 6, E6-S07)
// Mobile-first, no auth required, GPS priority
// =============================================================

export const metadata: Metadata = {
  title: 'Reportar Avistamento — ReunIA',
  description: 'Você viu uma criança desaparecida? Reporte aqui. Cada informação pode salvar uma vida.',
  openGraph: {
    title: 'Reportar Avistamento — ReunIA',
    description: 'Ajude a encontrar crianças desaparecidas reportando um avistamento.',
  },
}

export default function ReportSightingPage() {
  return (
    <>
      <Header />
      <main id="main-content" className="min-h-screen py-10 px-4" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
        <div className="max-w-lg mx-auto">
          {/* Hero */}
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
              style={{ backgroundColor: 'var(--color-coral-hope-light)' }}
            >
              <span className="text-2xl">👁</span>
            </div>
            <h1
              className="text-2xl font-bold mb-2"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
            >
              Você viu uma criança desaparecida?
            </h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Cada informação conta. Reporte o que viu — nossa equipe irá verificar e contatar as autoridades.
              Você não precisa criar uma conta.
            </p>
          </div>

          {/* Urgency callout */}
          <div
            className="flex items-center gap-3 p-4 rounded-xl mb-6"
            style={{
              backgroundColor: 'rgba(232, 99, 74, 0.08)',
              borderLeft: '4px solid var(--color-coral-hope)',
            }}
          >
            <span className="text-xl">⚡</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-coral-hope)' }}>
                Emergência imediata?
              </p>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Se a criança está em perigo agora, ligue <strong>190</strong> (Polícia) antes de preencher este formulário.
              </p>
            </div>
          </div>

          {/* Form card */}
          <div
            className="rounded-2xl border p-6"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              borderColor: 'var(--color-border)',
              boxShadow: 'var(--shadow-elevated)',
            }}
          >
            <SightingForm />
          </div>

          {/* Help numbers */}
          <div className="mt-8 text-center space-y-2">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Números de ajuda
            </p>
            <div className="flex justify-center gap-6 flex-wrap">
              <div className="text-center">
                <p
                  className="text-2xl font-bold"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-coral-hope)' }}
                >
                  188
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>CVV — Apoio emocional</p>
              </div>
              <div className="text-center">
                <p
                  className="text-2xl font-bold"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-deep-indigo)' }}
                >
                  181
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Disque Denúncia</p>
              </div>
              <div className="text-center">
                <p
                  className="text-2xl font-bold"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-deep-indigo)' }}
                >
                  190
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Emergência — Polícia</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
