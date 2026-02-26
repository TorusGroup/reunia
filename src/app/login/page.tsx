import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

// =============================================================
// Login Page — ReunIA
// Simple placeholder — full auth in Sprint 5
// =============================================================

export const metadata: Metadata = {
  title: 'Entrar — ReunIA',
  description: 'Acesse sua conta na plataforma ReunIA.',
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return (
    <>
      <Header />
      <main
        id="main-content"
        className="min-h-screen flex items-center justify-center py-12 px-4"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        <div
          className="w-full max-w-md rounded-2xl border p-8"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            borderColor: 'var(--color-border)',
            boxShadow: 'var(--shadow-elevated)',
          }}
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 mb-8">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ backgroundColor: 'var(--color-deep-indigo)' }}
            >
              <span className="text-sm font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
                R
              </span>
            </div>
            <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}>
              Reun<span style={{ color: 'var(--color-coral-hope)' }}>IA</span>
            </span>
          </Link>

          <h1
            className="text-2xl font-bold mb-2"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            Entrar na plataforma
          </h1>
          <p className="text-sm mb-8" style={{ color: 'var(--color-text-secondary)' }}>
            Sistema de autenticacao em desenvolvimento. Por enquanto, todas as funcoes publicas estao disponiveis sem login.
          </p>

          {/* Info box */}
          <div
            className="rounded-xl p-4 mb-6"
            style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
          >
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-deep-indigo)' }}>
              O que voce pode fazer sem login:
            </p>
            <ul className="space-y-1.5">
              {[
                'Buscar crianças desaparecidas',
                'Ver detalhes de casos',
                'Reportar avistamentos',
                'Cadastrar alertas por localizacao',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-found-green)" strokeWidth="2.5" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <Link
              href="/search"
              className="flex items-center justify-center w-full py-3 rounded-xl text-white font-semibold text-sm transition-all"
              style={{ backgroundColor: 'var(--color-coral-hope)', fontFamily: 'var(--font-heading)' }}
            >
              Buscar agora — sem login
            </Link>
            <Link
              href="/report-sighting"
              className="flex items-center justify-center w-full py-3 rounded-xl font-semibold text-sm transition-all"
              style={{
                border: '1.5px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-heading)',
              }}
            >
              Reportar avistamento
            </Link>
            <Link
              href="/"
              className="flex items-center justify-center w-full py-2 text-sm transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Voltar ao inicio
            </Link>
          </div>

          {/* CVV */}
          <p className="text-center mt-8 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Em emergencia:{' '}
            <a href="tel:188" style={{ color: 'var(--color-coral-hope)', fontWeight: 700 }}>CVV 188</a>
            {' '}ou{' '}
            <a href="tel:190" style={{ color: 'var(--color-deep-indigo)', fontWeight: 700 }}>Policia 190</a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
