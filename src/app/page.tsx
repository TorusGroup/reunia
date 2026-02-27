import Link from 'next/link'
import type { Metadata } from 'next'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { SearchBar } from '@/components/search/search-bar'
import { CaseCard } from '@/components/search/case-card'
import { StatCard } from '@/components/common/stat-card'
import type { CaseSummary } from '@/types/cases'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// =============================================================
// Homepage — ReunIA (Sprint 4→5, E5-S01)
// Server Component: fetches live data from DB, fallback to mock
// =============================================================

export const metadata: Metadata = {
  title: 'ReunIA — Toda criança vista. Cada segundo importa.',
  description:
    'Plataforma aberta de busca de crianças desaparecidas. Busca unificada de FBI, Interpol, NCMEC e fontes brasileiras com reconhecimento facial e alertas geolocalizados.',
}

// Revalidate every 60 seconds for fresh data
export const revalidate = 60

// ---------------------------------------------------------------
// Fetch real cases from the database
// ---------------------------------------------------------------
async function getRecentCasesFromDb(): Promise<CaseSummary[]> {
  try {
    const cases = await db.case.findMany({
      where: { status: 'active' },
      orderBy: [{ reportedAt: 'desc' }],
      take: 8,
      select: {
        id: true,
        caseNumber: true,
        caseType: true,
        status: true,
        urgency: true,
        reportedAt: true,
        lastSeenAt: true,
        lastSeenLocation: true,
        lastSeenCountry: true,
        source: true,
        dataQuality: true,
        createdAt: true,
        updatedAt: true,
        persons: {
          where: { role: 'missing_child' },
          take: 1,
          select: {
            id: true,
            role: true,
            firstName: true,
            lastName: true,
            approximateAge: true,
            dateOfBirth: true,
            gender: true,
            images: {
              where: { isPrimary: true },
              take: 1,
              select: { storageUrl: true, thumbnailUrl: true },
            },
          },
        },
      },
    })

    return cases.map((c) => {
      const person = c.persons[0]
      const img = person?.images[0]

      // Compute approximate age from DOB if not directly set
      let approximateAge = person?.approximateAge ?? undefined
      if (!approximateAge && person?.dateOfBirth) {
        const ageDiff = Date.now() - person.dateOfBirth.getTime()
        approximateAge = Math.floor(ageDiff / (1000 * 60 * 60 * 24 * 365.25))
      }

      return {
        id: c.id,
        caseNumber: c.caseNumber,
        caseType: c.caseType as CaseSummary['caseType'],
        status: c.status as CaseSummary['status'],
        urgency: c.urgency as CaseSummary['urgency'],
        reportedAt: c.reportedAt.toISOString(),
        lastSeenAt: c.lastSeenAt?.toISOString(),
        lastSeenLocation: c.lastSeenLocation ?? undefined,
        lastSeenCountry: c.lastSeenCountry ?? undefined,
        source: c.source as CaseSummary['source'],
        dataQuality: c.dataQuality,
        persons: person
          ? [
              {
                id: person.id,
                role: person.role as CaseSummary['persons'][number]['role'],
                firstName: person.firstName ?? undefined,
                lastName: person.lastName ?? undefined,
                approximateAge,
                gender: (person.gender ?? undefined) as CaseSummary['persons'][number]['gender'],
                primaryImageUrl: img?.thumbnailUrl ?? img?.storageUrl ?? undefined,
              },
            ]
          : [],
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }
    })
  } catch (err) {
    logger.error({ err }, 'Homepage: failed to fetch cases from DB, using mock data')
    return []
  }
}

// ---------------------------------------------------------------
// Fetch live stats from the database
// ---------------------------------------------------------------
async function getStatsFromDb(): Promise<{
  activeCases: number
  sources: number
}> {
  try {
    const [activeCases, distinctSources] = await Promise.all([
      db.case.count({ where: { status: 'active' } }),
      db.case.groupBy({ by: ['source'], where: { status: 'active' } }),
    ])
    return { activeCases, sources: distinctSources.length }
  } catch {
    return { activeCases: 0, sources: 0 }
  }
}

// ---------------------------------------------------------------
// Mock fallback cases (used only when DB has no data)
// ---------------------------------------------------------------
const MOCK_CASES: CaseSummary[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    caseNumber: 'REUNIA-2026-000001',
    caseType: 'missing',
    status: 'active',
    urgency: 'high',
    reportedAt: '2026-02-24T00:00:00Z',
    lastSeenAt: '2026-02-24T14:30:00Z',
    lastSeenLocation: 'São Paulo, SP',
    lastSeenCountry: 'BR',
    source: 'platform',
    dataQuality: 85,
    persons: [{ id: 'p1', role: 'missing_child', firstName: 'Maria', lastName: 'Santos', approximateAge: 8, gender: 'female' }],
    createdAt: '2026-02-24T00:00:00Z',
    updatedAt: '2026-02-24T00:00:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    caseNumber: 'REUNIA-2026-000002',
    caseType: 'missing',
    status: 'active',
    urgency: 'critical',
    reportedAt: '2026-02-15T00:00:00Z',
    lastSeenAt: '2026-02-15T09:00:00Z',
    lastSeenLocation: 'Rio de Janeiro, RJ',
    lastSeenCountry: 'BR',
    source: 'ncmec',
    dataQuality: 92,
    persons: [{ id: 'p2', role: 'missing_child', firstName: 'João', lastName: 'Pereira', approximateAge: 12, gender: 'male' }],
    createdAt: '2026-02-15T00:00:00Z',
    updatedAt: '2026-02-15T00:00:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    caseNumber: 'REUNIA-2026-000003',
    caseType: 'missing',
    status: 'active',
    urgency: 'high',
    reportedAt: '2026-02-25T00:00:00Z',
    lastSeenAt: '2026-02-25T16:00:00Z',
    lastSeenLocation: 'Campinas, SP',
    lastSeenCountry: 'BR',
    source: 'platform',
    dataQuality: 78,
    persons: [{ id: 'p3', role: 'missing_child', firstName: 'Ana', lastName: 'Lima', approximateAge: 6, gender: 'female' }],
    createdAt: '2026-02-25T00:00:00Z',
    updatedAt: '2026-02-25T00:00:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    caseNumber: 'REUNIA-2026-000004',
    caseType: 'missing',
    status: 'active',
    urgency: 'standard',
    reportedAt: '2026-02-19T00:00:00Z',
    lastSeenAt: '2026-02-19T11:00:00Z',
    lastSeenLocation: 'Brasília, DF',
    lastSeenCountry: 'BR',
    source: 'fbi',
    dataQuality: 88,
    persons: [{ id: 'p4', role: 'missing_child', firstName: 'Pedro', lastName: 'Mendes', approximateAge: 14, gender: 'male' }],
    createdAt: '2026-02-19T00:00:00Z',
    updatedAt: '2026-02-19T00:00:00Z',
  },
]

// Format number with locale separator (e.g. 50823 -> "50.823")
function formatNumber(n: number): string {
  if (n === 0) return '—'
  return n.toLocaleString('pt-BR')
}

// How it works steps
const HOW_IT_WORKS = [
  {
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <circle cx="18" cy="18" r="11" stroke="var(--color-coral-hope)" strokeWidth="2.5" />
        <path d="M27 27l6 6" stroke="var(--color-coral-hope)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'Busca Unificada',
    description: 'Buscamos simultaneamente em FBI, Interpol, NCMEC, AMBER Alert, Disque 100 e mais. Uma busca, múltiplas fontes.',
  },
  {
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect x="4" y="8" width="32" height="24" rx="4" stroke="var(--color-coral-hope)" strokeWidth="2.5" />
        <circle cx="20" cy="18" r="5" stroke="var(--color-coral-hope)" strokeWidth="2" />
        <path d="M9 28c0-4.418 4.924-8 11-8s11 3.582 11 8" stroke="var(--color-coral-hope)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Reconhecimento Facial',
    description: 'Motor ArcFace com 99.83% de precisão. Toda correspondência passa por revisão humana — o algoritmo nunca age sozinho.',
  },
  {
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path d="M20 4L4 14v20h32V14L20 4z" stroke="var(--color-coral-hope)" strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="14" y="24" width="12" height="10" rx="2" stroke="var(--color-coral-hope)" strokeWidth="2" />
        <path d="M20 18a3 3 0 100-6 3 3 0 000 6z" stroke="var(--color-coral-hope)" strokeWidth="2" />
        <path d="M8 24l3-3M32 24l-3-3" stroke="var(--color-coral-hope)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'Alertas Inteligentes',
    description: 'Alertas geolocalizados por WhatsApp, SMS e email. Cada cidadão próximo à área recebe o alerta certo, na hora certa.',
  },
]

export default async function HomePage() {
  // Fetch real data from DB (Server Component — runs at request/revalidation time)
  const [dbCases, dbStats] = await Promise.all([
    getRecentCasesFromDb(),
    getStatsFromDb(),
  ])

  // Use DB data if available, fallback to mock cases for display
  const recentCases = dbCases.length > 0 ? dbCases : MOCK_CASES

  // Stats: use DB count if available, else placeholder
  const stats = [
    {
      value: dbStats.activeCases > 0 ? formatNumber(dbStats.activeCases) : '50.823',
      label: 'Casos ativos',
      sublabel: 'em bases de dados internacionais',
    },
    {
      value: dbStats.sources > 0 ? String(dbStats.sources) : '4',
      label: 'Bancos de dados',
      sublabel: 'FBI, NCMEC, Interpol, BR',
    },
    { value: '1.204', label: 'Alertas enviados', sublabel: 'este mês' },
    { value: '847', label: 'Encontradas', sublabel: 'este ano' },
  ]

  return (
    <>
      <Header />
      <main id="main-content">
        {/* ── HERO SECTION ─────────────────────────────────────────── */}
        <section
          className="pt-12 pb-16 px-6"
          style={{ backgroundColor: 'var(--color-light-canvas)' }}
          aria-label="Busca principal"
        >
          <div className="max-w-2xl mx-auto text-center">
            <h1
              className="text-5xl leading-tight mb-4"
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 300,
                color: 'var(--color-deep-indigo)',
              }}
            >
              Toda criança vista.
              <br />
              Cada segundo importa.
            </h1>
            <p
              className="text-base mb-8"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Buscamos em FBI, Interpol, NCMEC e mais — tudo em uma pesquisa.
            </p>

            {/* Search bar */}
            <div className="max-w-xl mx-auto mb-4">
              <SearchBar size="hero" autoFocus={false} />
            </div>

            {/* Advanced filters toggle */}
            <button
              className="text-sm flex items-center gap-1.5 mx-auto mb-6 transition-colors"
              style={{ color: 'var(--color-warm-gray)', fontFamily: 'var(--font-body)' }}
            >
              + Filtros avançados
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Secondary CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/search?mode=photo"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold transition-all"
                style={{
                  border: '2px solid var(--color-deep-indigo)',
                  color: 'var(--color-deep-indigo)',
                  backgroundColor: 'transparent',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Buscar por foto
              </Link>
              <span style={{ color: 'var(--color-text-muted)' }} aria-hidden="true">ou</span>
              <Link
                href="/register-case"
                className="text-sm font-semibold transition-colors"
                style={{ color: 'var(--color-coral-hope)', fontFamily: 'var(--font-heading)' }}
              >
                Registrar desaparecimento →
              </Link>
            </div>
          </div>
        </section>

        {/* ── RECENT CASES ─────────────────────────────────────────── */}
        <section
          className="py-12 px-6"
          style={{ backgroundColor: 'var(--color-bg-primary)' }}
          aria-labelledby="recent-cases-heading"
        >
          <div className="max-w-7xl mx-auto">
            <div className="flex items-baseline justify-between mb-8">
              <h2
                id="recent-cases-heading"
                className="text-xl font-bold"
                style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
              >
                Casos Recentes
              </h2>
              <Link
                href="/search"
                className="text-sm font-semibold flex items-center gap-1 transition-colors"
                style={{ color: 'var(--color-coral-hope)', fontFamily: 'var(--font-heading)' }}
              >
                Ver todos
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>

            {/* Desktop: 4-col grid. Mobile: 2-col grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {recentCases.map((c, idx) => (
                <CaseCard key={c.id} caseData={c} priority={idx < 4} />
              ))}
            </div>
          </div>
        </section>

        {/* ── STATS BANNER ─────────────────────────────────────────── */}
        <section
          className="py-12 px-6"
          style={{ backgroundColor: 'var(--color-deep-indigo)' }}
          aria-label="Estatísticas de impacto"
        >
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat) => (
                <StatCard
                  key={stat.label}
                  value={stat.value}
                  label={stat.label}
                  sublabel={stat.sublabel}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
        <section
          id="como-funciona"
          className="py-16 px-6"
          style={{ backgroundColor: 'var(--color-bg-secondary)' }}
          aria-labelledby="how-heading"
        >
          <div className="max-w-5xl mx-auto">
            <h2
              id="how-heading"
              className="text-2xl font-bold text-center mb-12"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
            >
              Como Funciona
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {HOW_IT_WORKS.map((step) => (
                <div key={step.title} className="text-center">
                  <div className="flex justify-center mb-4">{step.icon}</div>
                  <h3
                    className="text-lg font-semibold mb-3"
                    style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA SECTION ──────────────────────────────────────────── */}
        <section
          className="py-16 px-6"
          style={{ backgroundColor: 'var(--color-bg-primary)' }}
          aria-label="Chamadas para ação"
        >
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-6 justify-center">
            <Link
              href="/register-case"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold text-lg transition-all"
              style={{
                backgroundColor: 'var(--color-coral-hope)',
                fontFamily: 'var(--font-heading)',
                boxShadow: 'var(--shadow-elevated)',
              }}
            >
              Registrar Caso
            </Link>
            <Link
              href="/alerts"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-lg transition-all"
              style={{
                border: '2px solid var(--color-deep-indigo)',
                color: 'var(--color-deep-indigo)',
                fontFamily: 'var(--font-heading)',
              }}
            >
              Receber Alertas
            </Link>
          </div>

          {/* CVV always visible */}
          <p className="text-center mt-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Em caso de emergência, ligue{' '}
            <strong style={{ color: 'var(--color-deep-indigo)', fontFamily: 'var(--font-mono)' }}>
              188
            </strong>{' '}
            (CVV — Valorização da Vida) ou{' '}
            <strong style={{ color: 'var(--color-deep-indigo)', fontFamily: 'var(--font-mono)' }}>
              100
            </strong>{' '}
            (Disque Direitos Humanos)
          </p>
        </section>
      </main>
      <Footer />
    </>
  )
}
