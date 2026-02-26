import Link from 'next/link'
import type { Metadata } from 'next'

// =============================================================
// Custom 404 — "Página não encontrada" (E8-S04 — Sprint 7)
// Includes search prompt and CVV 188
// =============================================================

export const metadata: Metadata = {
  title: 'Página não encontrada',
  robots: { index: false, follow: false },
}

export default function NotFound() {
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
      {/* Logo / brand */}
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

      {/* 404 code */}
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
        404
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
        Página não encontrada
      </h1>

      <p
        style={{
          fontSize: '1rem',
          color: '#6B7280',
          textAlign: 'center',
          maxWidth: '480px',
          marginBottom: '2rem',
          lineHeight: 1.6,
        }}
      >
        A página que você está procurando não existe ou foi movida.
        Se você está buscando por uma criança desaparecida, use nossa busca.
      </p>

      {/* Search CTA */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginBottom: '3rem',
        }}
      >
        <Link
          href="/search"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            backgroundColor: 'var(--color-coral-hope, #E8634A)',
            color: '#fff',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.9375rem',
          }}
        >
          Buscar crianças desaparecidas
        </Link>

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
