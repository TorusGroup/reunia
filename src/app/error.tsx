'use client'

import { useEffect } from 'react'
import Link from 'next/link'

// =============================================================
// Custom 500 Error Page (E8-S04 — Sprint 7)
// "Erro no sistema" with CVV 188
// Note: error.tsx must be a Client Component
// =============================================================

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log error to monitoring service in production
    console.error('Application error:', error)
  }, [error])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-soft-cream, #FFF8F0)',
        padding: '2rem',
        fontFamily: 'var(--font-jakarta, "Plus Jakarta Sans", sans-serif)',
      }}
    >
      {/* Logo */}
      <Link
        href="/"
        style={{
          textDecoration: 'none',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--color-deep-indigo, #2D3561)',
          }}
        >
          Reun
        </span>
        <span
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--color-coral-hope, #E8634A)',
          }}
        >
          IA
        </span>
      </Link>

      {/* Error code */}
      <div
        aria-hidden="true"
        style={{
          fontSize: '8rem',
          fontWeight: 800,
          color: 'var(--color-deep-indigo, #2D3561)',
          lineHeight: 1,
          opacity: 0.15,
          marginBottom: '-1rem',
          fontFamily: '"JetBrains Mono", monospace',
        }}
      >
        500
      </div>

      {/* Main message */}
      <h1
        style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: 'var(--color-deep-indigo, #2D3561)',
          textAlign: 'center',
          marginBottom: '0.75rem',
        }}
      >
        Erro no sistema
      </h1>

      <p
        style={{
          fontSize: '1rem',
          color: '#6B7280',
          textAlign: 'center',
          maxWidth: '480px',
          marginBottom: '0.5rem',
          lineHeight: 1.6,
        }}
      >
        Ocorreu um erro inesperado. Nossa equipe foi notificada.
        Por favor, tente novamente em alguns instantes.
      </p>

      {/* Error digest for support */}
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

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginBottom: '3rem',
        }}
      >
        <button
          onClick={reset}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            backgroundColor: 'var(--color-coral-hope, #E8634A)',
            color: '#fff',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9375rem',
            fontFamily: 'inherit',
          }}
          type="button"
        >
          Tentar novamente
        </button>

        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            backgroundColor: 'transparent',
            color: 'var(--color-deep-indigo, #2D3561)',
            border: '1.5px solid var(--color-deep-indigo, #2D3561)',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.9375rem',
          }}
        >
          Voltar ao início
        </Link>
      </div>

      {/* CVV 188 — NON-NEGOTIABLE */}
      <div
        style={{
          borderTop: '1px solid rgba(0,0,0,0.08)',
          paddingTop: '1.5rem',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: '0.875rem',
            color: '#6B7280',
            marginBottom: '0.25rem',
          }}
        >
          Em caso de emergência sobre criança desaparecida:
        </p>
        <a
          href="tel:188"
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--color-coral-hope, #E8634A)',
            textDecoration: 'none',
            fontFamily: '"JetBrains Mono", monospace',
          }}
          aria-label="CVV — Centro de Valorização da Vida, ligue 188"
        >
          CVV 188
        </a>
        <span
          style={{
            fontSize: '0.875rem',
            color: '#6B7280',
            marginLeft: '0.5rem',
          }}
        >
          — Disque Denúncia 181
        </span>
      </div>
    </div>
  )
}
