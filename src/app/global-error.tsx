'use client'

import { useEffect } from 'react'

// =============================================================
// Root Error Boundary (E8-S04 — Sprint 7)
// Catches errors in root layout — last resort
// Must include <html> and <body> tags
// =============================================================

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html lang="pt-BR">
      <head>
        <title>Erro crítico | ReunIA</title>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: '#FFF8F0',
          fontFamily: '"Plus Jakarta Sans", sans-serif',
        }}
      >
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
          }}
        >
          {/* Logo text fallback */}
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '2rem',
            }}
          >
            <span style={{ color: '#2D3561' }}>Reun</span>
            <span style={{ color: '#E8634A' }}>IA</span>
          </div>

          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#2D3561',
              textAlign: 'center',
              marginBottom: '1rem',
            }}
          >
            Erro crítico no sistema
          </h1>

          <p
            style={{
              fontSize: '1rem',
              color: '#6B7280',
              textAlign: 'center',
              maxWidth: '400px',
              marginBottom: '2rem',
              lineHeight: 1.6,
            }}
          >
            Ocorreu um erro crítico. Nossa equipe foi notificada.
            Por favor, recarregue a página para continuar.
          </p>

          {error.digest && (
            <p
              style={{
                fontSize: '0.75rem',
                color: '#9CA3AF',
                marginBottom: '2rem',
                fontFamily: '"JetBrains Mono", monospace',
              }}
            >
              Código: {error.digest}
            </p>
          )}

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '3rem' }}>
            <button
              onClick={reset}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#E8634A',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.9375rem',
                fontFamily: 'inherit',
              }}
              type="button"
            >
              Tentar novamente
            </button>

            <a
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.75rem 1.5rem',
                color: '#2D3561',
                border: '1.5px solid #2D3561',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.9375rem',
              }}
            >
              Voltar ao início
            </a>
          </div>

          {/* CVV 188 — NON-NEGOTIABLE */}
          <div
            style={{
              borderTop: '1px solid rgba(0,0,0,0.08)',
              paddingTop: '1.5rem',
              textAlign: 'center',
              width: '100%',
              maxWidth: '400px',
            }}
          >
            <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>
              Em caso de emergência:
            </p>
            <a
              href="tel:188"
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#E8634A',
                textDecoration: 'none',
                fontFamily: '"JetBrains Mono", monospace',
              }}
              aria-label="CVV 188"
            >
              CVV 188
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
