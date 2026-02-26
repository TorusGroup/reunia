'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'

// =============================================================
// Sidebar Component — Law Enforcement Dashboard (E1-S08 placeholder)
// Full implementation in Sprint 6 (E7)
// =============================================================

interface SidebarItem {
  label: string
  href: string
  icon?: React.ReactNode
  badge?: number
}

const leNavigationItems: SidebarItem[] = [
  { label: 'Visão Geral', href: '/admin' },
  { label: 'Casos', href: '/admin/cases' },
  { label: 'Fila HITL', href: '/validation', badge: 0 },
  { label: 'Analytics', href: '/admin/analytics' },
  { label: 'Usuários', href: '/admin/users' },
  { label: 'Fontes de Dados', href: '/admin/data-sources' },
  { label: 'Saúde do Sistema', href: '/admin/health' },
  { label: 'Auditoria', href: '/admin/audit' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="flex flex-col w-64 min-h-screen border-r"
      style={{
        backgroundColor: 'var(--color-deep-indigo)',
        borderColor: '#3A4275',
      }}
      aria-label="Navegação do painel"
    >
      {/* Logo area */}
      <div
        className="flex items-center gap-3 px-6 h-16 border-b"
        style={{ borderColor: '#3A4275' }}
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ backgroundColor: 'var(--color-coral-hope)' }}
        >
          <span
            className="text-sm font-bold text-white"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            R
          </span>
        </div>
        <span
          className="text-base font-bold text-white"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Reun<span style={{ color: 'var(--color-coral-hope)' }}>IA</span>
        </span>
        <span
          className="ml-auto text-xs px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: 'rgba(232,99,74,0.2)',
            color: 'var(--color-coral-hope)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          LE
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3" aria-label="Navegação principal do painel">
        <ul className="space-y-1">
          {leNavigationItems.map(({ label, href, badge }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`)

            return (
              <li key={href}>
                <Link
                  href={href}
                  className={clsx(
                    'flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    isActive
                      ? 'bg-[#E8634A] text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                  style={{ fontFamily: 'var(--font-body)' }}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span>{label}</span>
                  {badge !== undefined && badge > 0 && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                      style={{
                        backgroundColor: 'var(--color-alert-amber)',
                        color: 'white',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Bottom — HITL reminder */}
      <div
        className="p-4 m-3 rounded-lg text-xs"
        style={{
          backgroundColor: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.3)',
          color: 'var(--color-found-green)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <p className="font-semibold mb-1">HITL ATIVO</p>
        <p className="opacity-80">
          Toda correspondência facial requer revisão humana antes de qualquer ação.
        </p>
      </div>
    </aside>
  )
}
