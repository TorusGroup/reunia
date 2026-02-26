import type { Metadata } from 'next'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { AlertSubscription } from '@/components/alerts/alert-subscription'

// =============================================================
// Alert Subscription Page — Public Route Group (Sprint 4, E5-S05)
// =============================================================

export const metadata: Metadata = {
  title: 'Receber Alertas de Desaparecimentos — ReunIA',
  description: 'Cadastre-se para receber alertas de desaparecimentos de crianças na sua região via WhatsApp, email ou SMS.',
  robots: { index: true, follow: true },
}

export default function AlertsPage() {
  return (
    <>
      <Header />
      <main
        id="main-content"
        className="min-h-screen py-10 px-4"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1
              className="text-3xl font-bold mb-2"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
            >
              Receba Alertas de Desaparecimentos
            </h1>
            <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
              Seja os olhos da sua comunidade.
            </p>
          </div>

          {/* How it works (3 bullets) */}
          <div
            className="flex flex-col gap-3 mb-8 p-5 rounded-xl"
            style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }}
          >
            {[
              { icon: '📍', text: 'Defina sua localização e raio de cobertura' },
              { icon: '⚡', text: 'Receba alertas imediatos quando uma criança desaparece na sua área' },
              { icon: '👁', text: 'Se vir a criança, reporte com um toque — cada informação importa' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">{icon}</span>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{text}</p>
              </div>
            ))}
          </div>

          <AlertSubscription />

          {/* Trust signals */}
          <div className="mt-6 space-y-2">
            {[
              'Nunca compartilhamos seus dados com terceiros',
              'Você pode cancelar a qualquer momento via link em cada mensagem',
              'Conforme a LGPD — seus dados são protegidos e criptografados',
            ].map((text) => (
              <div key={text} className="flex items-start gap-2">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-found-green)"
                  strokeWidth="2.5"
                  className="flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
