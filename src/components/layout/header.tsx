'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'

// =============================================================
// Header Component — Public header (E1-S08)
// Full navigation in Sprint 4 (E5)
// =============================================================

interface NavItem {
  label: string
  href: string
}

const publicNav: NavItem[] = [
  { label: 'Buscar', href: '/search' },
  { label: 'Como Funciona', href: '#como-funciona' },
  { label: 'Avistar', href: '/report-sighting' },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 text-decoration-none"
          aria-label="ReunIA — Página inicial"
        >
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg"
            style={{ backgroundColor: 'var(--color-deep-indigo)' }}
          >
            <span
              className="text-lg font-bold text-white"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              R
            </span>
          </div>
          <span
            className="text-xl font-bold"
            style={{
              fontFamily: 'var(--font-heading)',
              color: 'var(--color-deep-indigo)',
            }}
          >
            Reun<span style={{ color: 'var(--color-coral-hope)' }}>IA</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav aria-label="Navegação principal">
          <ul className="hidden md:flex items-center gap-6 list-none">
            {publicNav.map(({ label, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={clsx(
                    'text-sm font-medium transition-colors',
                    pathname === href
                      ? 'text-[color:var(--color-coral-hope)]'
                      : 'text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]'
                  )}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Auth actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="hidden sm:inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-heading)',
            }}
          >
            Entrar
          </Link>
          <Link
            href="/auth/register"
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white transition-all"
            style={{
              backgroundColor: 'var(--color-coral-hope)',
              fontFamily: 'var(--font-heading)',
            }}
          >
            Registrar Caso
          </Link>
        </div>
      </div>
    </header>
  )
}
