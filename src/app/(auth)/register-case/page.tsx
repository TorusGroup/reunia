import type { Metadata } from 'next'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { RegistrationForm } from '@/components/cases/registration-form'

// =============================================================
// Case Registration Page — Auth Route Group (Sprint 4, E5-S04)
// Multi-step form: Child data → Photos → Location → Contact+Consent
// =============================================================

export const metadata: Metadata = {
  title: 'Registrar Desaparecimento — ReunIA',
  description: 'Registre o desaparecimento de uma criança na plataforma ReunIA. Formulário seguro, dados protegidos pela LGPD.',
  robots: { index: false, follow: false },
}

export default function RegisterCasePage() {
  return (
    <>
      <Header />
      <main
        id="main-content"
        className="min-h-screen py-8 px-4"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        <div className="max-w-2xl mx-auto">
          {/* Top notice */}
          <div
            className="flex items-start gap-3 p-4 rounded-xl mb-8"
            style={{
              backgroundColor: 'var(--color-data-blue-light)',
              border: '1px solid var(--color-data-blue)',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-data-blue-dark)"
              strokeWidth="2"
              className="flex-shrink-0 mt-0.5"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
            </svg>
            <div>
              <p
                className="text-sm font-semibold"
                style={{ color: 'var(--color-data-blue-dark)', fontFamily: 'var(--font-heading)' }}
              >
                O registro é gratuito para famílias
              </p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-data-blue-dark)' }}>
                Seus dados são protegidos pela LGPD e usados exclusivamente para a busca. Em caso de emergência imediata, ligue{' '}
                <strong style={{ fontFamily: 'var(--font-mono)' }}>190</strong> (Polícia) ou{' '}
                <strong style={{ fontFamily: 'var(--font-mono)' }}>100</strong> (Disque Direitos Humanos).
              </p>
            </div>
          </div>

          <RegistrationForm />
        </div>
      </main>
      <Footer />
    </>
  )
}
