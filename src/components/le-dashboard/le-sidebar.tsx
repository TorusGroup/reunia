'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'

// =============================================================
// LE Sidebar — Navigation sidebar with role-based menu (Sprint 6)
// Deep Indigo background, 256px fixed on desktop
// =============================================================

interface NavItem {
  label: string
  href: string
  icon: string
  badge?: string
}

const navItems: NavItem[] = [
  { label: 'Visão Geral', href: '/le-dashboard', icon: '◎' },
  { label: 'Casos', href: '/le-dashboard/cases', icon: '📁' },
  { label: 'Validação HITL', href: '/le-dashboard/validation', icon: '🔍', badge: '!' },
  { label: 'Avistamentos', href: '/le-dashboard/sightings', icon: '👁' },
  { label: 'Analytics', href: '/le-dashboard/analytics', icon: '📊' },
  { label: 'Alerta Âmbar', href: '/le-dashboard/broadcast', icon: '⚠' },
]

export function LeSidebar() {
  const pathname = usePathname()

  return (
    <>
      {/* Mobile overlay toggle — hidden on desktop */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center px-4 h-14 border-b"
        style={{ backgroundColor: 'var(--color-deep-indigo)', borderColor: 'var(--color-deep-indigo-dark)' }}>
        <span className="text-white font-bold text-lg" style={{ fontFamily: 'var(--font-heading)' }}>
          Reun<span style={{ color: 'var(--color-coral-hope)' }}>IA</span>
          <span className="ml-2 text-sm font-normal opacity-70">Painel LE</span>
        </span>
      </div>

      {/* Sidebar */}
      <aside
        className="hidden lg:flex flex-col fixed top-0 left-0 h-full w-64 z-30"
        style={{ backgroundColor: 'var(--color-deep-indigo)' }}
        aria-label="Navegação do painel"
      >
        {/* Logo */}
        <div
          className="px-6 py-5 border-b"
          style={{ borderColor: 'var(--color-deep-indigo-dark)' }}
        >
          <Link href="/le-dashboard" className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ backgroundColor: 'var(--color-coral-hope)' }}
            >
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <div>
              <p
                className="font-bold text-white text-base leading-tight"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Reun<span style={{ color: 'var(--color-coral-hope)' }}>IA</span>
              </p>
              <p className="text-xs" style={{ color: 'var(--color-deep-indigo-light)', opacity: 0.8 }}>
                Law Enforcement
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p
            className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-deep-indigo-light)', opacity: 0.6 }}
          >
            Menu Principal
          </p>
          <ul className="space-y-1 list-none p-0 m-0">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                      isActive
                        ? 'text-white'
                        : 'text-[color:var(--color-deep-indigo-light)] hover:text-white'
                    )}
                    style={
                      isActive
                        ? { backgroundColor: 'rgba(255,255,255,0.12)' }
                        : undefined
                    }
                  >
                    <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span
                        className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--color-coral-hope)', color: 'white' }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Bottom: user actions */}
        <div
          className="px-3 py-4 border-t"
          style={{ borderColor: 'var(--color-deep-indigo-dark)' }}
        >
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
            style={{ color: 'var(--color-deep-indigo-light)', opacity: 0.7 }}
          >
            <span className="text-base">←</span>
            <span>Portal Público</span>
          </Link>
        </div>
      </aside>
    </>
  )
}
