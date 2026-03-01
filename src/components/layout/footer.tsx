import Link from 'next/link'

// =============================================================
// Footer Component — ReunIA (E1-S08)
// =============================================================

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      className="border-t py-12"
      style={{
        backgroundColor: 'var(--color-deep-indigo)',
        borderColor: '#3A4275',
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
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
                className="text-lg font-bold text-white"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Reun<span style={{ color: 'var(--color-coral-hope)' }}>IA</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Plataforma open source de busca de crianças desaparecidas com inteligência
              artificial. Dados públicos, privacidade por design.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3
              className="text-xs uppercase tracking-wider font-semibold mb-4"
              style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-body)' }}
            >
              Plataforma
            </h3>
            <ul className="space-y-2">
              {[
                { label: 'Buscar', href: '/search' },
                { label: 'Registrar Caso', href: '/register-case' },
                { label: 'Reportar Avistamento', href: '/report-sighting' },
                { label: 'Alertas Geolocalizados', href: '/geo-alerts' },
                { label: 'Painel Analitico', href: '/analytics' },
              ].map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm transition-colors"
                    style={{ color: 'rgba(255,255,255,0.6)' }}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3
              className="text-xs uppercase tracking-wider font-semibold mb-4"
              style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-body)' }}
            >
              Ajuda
            </h3>
            <ul className="space-y-2">
              {[
                { label: 'CVV — 188', href: 'tel:188' },
                { label: 'Disque 100', href: 'tel:100' },
                { label: 'Emergência — 190', href: 'tel:190' },
              ].map(({ label, href }) => (
                <li key={href}>
                  <a
                    href={href}
                    className="text-sm transition-colors"
                    style={{ color: 'rgba(255,255,255,0.6)' }}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <div className="flex items-center gap-3">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              © {currentYear} ReunIA. Open source sob licença Apache 2.0.
            </p>
            <Link
              href="/admin"
              className="text-xs transition-colors"
              style={{ color: 'rgba(255,255,255,0.25)' }}
            >
              Admin
            </Link>
          </div>
          <div className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <span className="text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
              Toda correspondência facial requer revisão humana
            </span>
            <span
              className="inline-flex items-center justify-center w-4 h-4 rounded-full text-xs"
              style={{ backgroundColor: 'var(--color-found-green)', color: 'white' }}
              title="HITL — Human in the Loop"
            >
              ✓
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
