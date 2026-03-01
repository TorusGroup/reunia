import type { Metadata } from 'next'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { SightingChat } from '@/components/sightings/sighting-chat'

// =============================================================
// Chat-based Sighting Report — Feature 5
// Conversational flow instead of form
// =============================================================

export const metadata: Metadata = {
  title: 'Reportar Avistamento via Chat — ReunIA',
  description: 'Reporte um avistamento de crianca desaparecida de forma conversacional. Cada informacao pode salvar uma vida.',
}

interface ChatReportPageProps {
  searchParams: Promise<{ caseId?: string }>
}

export default async function ChatReportPage({ searchParams }: ChatReportPageProps) {
  const { caseId } = await searchParams

  return (
    <>
      <Header />
      <main
        id="main-content"
        className="min-h-screen py-8 px-4"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        <div className="max-w-lg mx-auto">
          {/* Hero */}
          <div className="text-center mb-6">
            <h1
              className="text-2xl font-bold mb-2"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
            >
              Reportar Avistamento
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Converse com nosso assistente para reportar o que voce viu.
              Rapido, guiado e seguro.
            </p>
          </div>

          {/* Chat */}
          <SightingChat defaultCaseId={caseId} />

          {/* Alternatives */}
          <div className="mt-6 text-center space-y-2">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Prefere preencher um formulario?{' '}
              <a
                href={`/report-sighting${caseId ? `?caseId=${caseId}` : ''}`}
                className="font-medium"
                style={{ color: 'var(--color-coral-hope)' }}
              >
                Usar formulario tradicional
              </a>
            </p>
            <div className="flex justify-center gap-4 flex-wrap mt-3">
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Emergencia: <strong style={{ color: 'var(--color-coral-hope)' }}>190</strong>
              </span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Disque Denuncia: <strong style={{ color: 'var(--color-deep-indigo)' }}>181</strong>
              </span>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
