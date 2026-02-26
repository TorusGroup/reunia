import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { CaseGallery } from '@/components/cases/case-gallery'
import { CaseTimeline } from '@/components/cases/case-timeline'
import { ShareButtons } from '@/components/cases/share-buttons'
import type { CaseDetail } from '@/types/cases'
import type { TimelineEvent } from '@/components/cases/case-timeline'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// =============================================================
// Case Detail Page — Public Route Group (Sprint 4, E5-S03)
// Server Component — fetches real data from DB, falls back to notFound
// =============================================================

interface CaseDetailPageProps {
  params: Promise<{ id: string }>
}

// Real DB lookup with full relations
async function getCaseDetail(id: string): Promise<CaseDetail | null> {
  try {
    const c = await db.case.findUnique({
      where: { id },
      include: {
        persons: {
          include: {
            images: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
          },
        },
      },
    })

    if (!c) return null

    return {
      id: c.id,
      caseNumber: c.caseNumber,
      caseType: c.caseType as CaseDetail['caseType'],
      status: c.status as CaseDetail['status'],
      urgency: c.urgency as CaseDetail['urgency'],
      reportedAt: c.reportedAt.toISOString(),
      lastSeenAt: c.lastSeenAt?.toISOString(),
      lastSeenLocation: c.lastSeenLocation ?? undefined,
      lastSeenCountry: c.lastSeenCountry ?? undefined,
      source: c.source as CaseDetail['source'],
      dataQuality: c.dataQuality,
      circumstances: c.circumstances ?? undefined,
      sourceUrl: c.sourceUrl ?? undefined,
      rewardAmount: c.rewardAmount ? Number(c.rewardAmount) : undefined,
      rewardCurrency: c.rewardCurrency ?? undefined,
      consentGiven: c.consentGiven,
      resolvedAt: c.resolvedAt?.toISOString(),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      persons: c.persons.map((p) => ({
        id: p.id,
        role: p.role as CaseDetail['persons'][number]['role'],
        firstName: p.firstName ?? undefined,
        lastName: p.lastName ?? undefined,
        aliases: (p.aliases as string[] | null) ?? [],
        nickname: p.nickname ?? undefined,
        approximateAge: p.approximateAge ?? undefined,
        ageAtDisappearance: p.ageAtDisappearance ?? undefined,
        dateOfBirth: p.dateOfBirth?.toISOString().split('T')[0],
        gender: (p.gender ?? undefined) as CaseDetail['persons'][number]['gender'],
        nationality: (p.nationality as string[] | null) ?? [],
        heightCm: p.heightCm ?? undefined,
        weightKg: p.weightKg ?? undefined,
        hairColor: p.hairColor ?? undefined,
        hairLength: p.hairLength ?? undefined,
        eyeColor: p.eyeColor ?? undefined,
        skinTone: p.skinTone ?? undefined,
        distinguishingMarks: p.distinguishingMarks ?? undefined,
        clothingDescription: p.clothingDescription ?? undefined,
        medicalConditions: p.medicalConditions ?? undefined,
        languagesSpoken: (p.languagesSpoken as string[] | null) ?? [],
        images: p.images.map((img) => ({
          id: img.id,
          storageUrl: img.storageUrl,
          thumbnailUrl: img.thumbnailUrl ?? undefined,
          imageType: img.imageType as CaseDetail['persons'][number]['images'][number]['imageType'],
          isPrimary: img.isPrimary,
          takenAt: img.takenAt?.toISOString(),
          sourceAttribution: img.sourceAttribution ?? undefined,
          width: img.width ?? undefined,
          height: img.height ?? undefined,
          hasFace: img.hasFace ?? undefined,
          faceQualityScore: img.faceQualityScore ?? undefined,
          createdAt: img.createdAt.toISOString(),
        })),
      })),
    }
  } catch (err) {
    logger.error({ err, id }, 'getCaseDetail: DB error')
    return null
  }
}

export async function generateMetadata({ params }: CaseDetailPageProps): Promise<Metadata> {
  const { id } = await params
  const caseData = await getCaseDetail(id)

  if (!caseData) {
    return {
      title: 'Caso não encontrado',
      robots: { index: false, follow: false },
    }
  }

  const person = caseData.persons[0]
  const name = person ? `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() : 'Desconhecido'

  return {
    title: `${name} — ${caseData.caseNumber}`,
    description: `Caso ativo: ${name}, ${person?.approximateAge ?? '?'} anos. Última vez vista em ${caseData.lastSeenLocation ?? 'local desconhecido'}. Ajude a encontrar esta criança.`,
    robots: { index: false, follow: false }, // Case pages are private by default (per PRD)
  }
}

function daysMissing(lastSeenAt?: string): number | null {
  if (!lastSeenAt) return null
  return Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60 * 24))
}

const SOURCE_LABELS: Record<string, string> = {
  fbi: 'FBI (Federal Bureau of Investigation)',
  ncmec: 'NCMEC (National Center for Missing & Exploited Children)',
  interpol: 'Interpol',
  amber: 'AMBER Alert',
  platform: 'ReunIA (registro direto)',
  disque100: 'Disque 100 — Direitos Humanos',
}

// Mock timeline for MVP
function buildTimeline(caseData: CaseDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: 'evt-1',
      date: caseData.reportedAt,
      title: 'Caso registrado',
      description: 'Caso cadastrado na plataforma ReunIA.',
      type: 'registered',
    },
  ]

  if (caseData.lastSeenAt) {
    events.unshift({
      id: 'evt-0',
      date: caseData.lastSeenAt,
      title: 'Último avistamento confirmado',
      description: caseData.lastSeenLocation,
      type: 'update',
    })
  }

  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

export default async function CaseDetailPage({ params }: CaseDetailPageProps) {
  const { id } = await params

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) notFound()

  const caseData = await getCaseDetail(id)
  if (!caseData) notFound()

  const person = caseData.persons[0]
  const personName = person
    ? `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Identidade desconhecida'
    : 'Identidade desconhecida'

  const days = daysMissing(caseData.lastSeenAt)
  const timeline = buildTimeline(caseData)

  const lastSeenFormatted = caseData.lastSeenAt
    ? new Date(caseData.lastSeenAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <>
      <Header />
      <main
        id="main-content"
        className="min-h-screen pb-16"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Breadcrumb */}
          <nav aria-label="Navegação estrutural" className="flex items-center gap-2 text-sm mb-4 flex-wrap">
            <Link href="/" className="transition-colors" style={{ color: 'var(--color-text-muted)' }}>
              Início
            </Link>
            <span style={{ color: 'var(--color-text-muted)' }}>›</span>
            <Link href="/search" className="transition-colors" style={{ color: 'var(--color-text-muted)' }}>
              Busca
            </Link>
            <span style={{ color: 'var(--color-text-muted)' }}>›</span>
            <span style={{ color: 'var(--color-text-primary)' }}>{personName}</span>
          </nav>

          {/* Case header */}
          <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
            <div>
              <p
                className="text-xs tracking-widest"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', letterSpacing: '0.1em' }}
              >
                {caseData.caseNumber}
              </p>
            </div>
            {/* Urgency ribbon */}
            {days != null && (
              <div
                className="flex flex-col items-center px-4 py-2 rounded-lg"
                style={{
                  backgroundColor: 'var(--color-alert-amber-light)',
                  border: '1px solid var(--color-alert-amber)',
                }}
              >
                <span
                  className="text-xs font-semibold uppercase"
                  style={{ color: '#92400E' }}
                >
                  ATIVO
                </span>
                <span
                  className="text-xl font-bold"
                  style={{ fontFamily: 'var(--font-mono)', color: '#92400E' }}
                >
                  {days}
                </span>
                <span className="text-xs" style={{ color: '#92400E' }}>
                  {days === 1 ? 'dia' : 'dias'}
                </span>
              </div>
            )}
          </div>

          {/* Two-column layout */}
          <div className="grid md:grid-cols-5 gap-8">
            {/* Photo column (40%) */}
            <div className="md:col-span-2">
              <CaseGallery images={person?.images ?? []} personName={personName} />

              <div className="mt-4 space-y-2">
                <Link
                  href={`/search?mode=photo&caseId=${caseData.id}`}
                  className="text-sm font-medium flex items-center gap-1.5 transition-colors"
                  style={{ color: 'var(--color-coral-hope)', fontFamily: 'var(--font-heading)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
                  </svg>
                  Buscar foto similar
                </Link>
              </div>
            </div>

            {/* Info column (60%) */}
            <div className="md:col-span-3 space-y-6">
              <h1
                className="text-3xl font-extrabold"
                style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
              >
                {personName}
              </h1>

              {/* Personal data card */}
              {person && (
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ border: '1px solid var(--color-border)' }}
                >
                  <div
                    className="px-4 py-3"
                    style={{
                      backgroundColor: 'var(--color-deep-indigo)',
                      color: 'white',
                      fontFamily: 'var(--font-heading)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Dados Pessoais
                  </div>
                  <div
                    className="divide-y"
                    style={{
                      backgroundColor: 'var(--color-bg-primary)',
                      borderColor: 'var(--color-border-subtle)',
                    }}
                  >
                    {[
                      { label: 'Idade', value: person.approximateAge ? `${person.approximateAge} anos${person.dateOfBirth ? ` (nasc. ${new Date(person.dateOfBirth).toLocaleDateString('pt-BR')})` : ''}` : null },
                      { label: 'Gênero', value: person.gender === 'female' ? 'Feminino' : person.gender === 'male' ? 'Masculino' : 'Outro' },
                      { label: 'Altura', value: person.heightCm ? `${(person.heightCm / 100).toFixed(2).replace('.', ',')}m` : null },
                      { label: 'Peso', value: person.weightKg ? `${person.weightKg}kg` : null },
                      { label: 'Olhos', value: person.eyeColor ?? null },
                      { label: 'Cabelo', value: person.hairColor ? `${person.hairColor}${person.hairLength ? `, ${person.hairLength}` : ''}` : null },
                      { label: 'Tom de pele', value: person.skinTone ?? null },
                      { label: 'Marcas', value: person.distinguishingMarks ?? null },
                    ]
                      .filter((row) => row.value)
                      .map(({ label, value }) => (
                        <div key={label} className="flex px-4 py-2.5 gap-4">
                          <dt
                            className="w-28 flex-shrink-0 text-sm"
                            style={{ color: 'var(--color-warm-gray)', fontFamily: 'var(--font-body)' }}
                          >
                            {label}
                          </dt>
                          <dd
                            className="text-sm font-medium"
                            style={{ color: 'var(--color-deep-indigo)' }}
                          >
                            {value}
                          </dd>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Circumstances */}
              {(caseData.lastSeenAt || caseData.lastSeenLocation || caseData.circumstances) && (
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ border: '1px solid var(--color-border)' }}
                >
                  <div
                    className="px-4 py-3"
                    style={{
                      backgroundColor: 'var(--color-deep-indigo)',
                      color: 'white',
                      fontFamily: 'var(--font-heading)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Circunstâncias
                  </div>
                  <div
                    className="p-4 space-y-3"
                    style={{ backgroundColor: 'var(--color-bg-primary)' }}
                  >
                    {lastSeenFormatted && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-warm-gray)' }}>
                          Última vez vista
                        </p>
                        <p className="text-sm" style={{ color: 'var(--color-deep-indigo)', fontFamily: 'var(--font-mono)' }}>
                          {lastSeenFormatted}
                        </p>
                        {caseData.lastSeenLocation && (
                          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            {caseData.lastSeenLocation}
                          </p>
                        )}
                      </div>
                    )}
                    {person?.clothingDescription && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-warm-gray)' }}>
                          Roupa no dia
                        </p>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {person.clothingDescription}
                        </p>
                      </div>
                    )}
                    {caseData.circumstances && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-warm-gray)' }}>
                          Descrição
                        </p>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                          {caseData.circumstances}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Map placeholder */}
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: '1px solid var(--color-border)' }}
              >
                <div
                  className="px-4 py-3"
                  style={{
                    backgroundColor: 'var(--color-deep-indigo)',
                    color: 'white',
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Mapa — Última Localização Conhecida
                </div>
                <div
                  className="h-60 flex items-center justify-center"
                  style={{ backgroundColor: '#E8EAF0' }}
                  role="img"
                  aria-label={`Mapa mostrando última localização conhecida em ${caseData.lastSeenLocation ?? 'local desconhecido'}`}
                >
                  <div className="text-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-coral-hope)" strokeWidth="2" className="mx-auto mb-2" aria-hidden="true">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <p className="text-sm" style={{ color: 'var(--color-warm-gray)' }}>
                      {caseData.lastSeenLocation ?? 'Localização não disponível'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      Mapa interativo — Sprint 6
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div
            className="mt-8 p-6 rounded-xl"
            style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }}
          >
            <h2
              className="text-base font-bold mb-4"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
            >
              Linha do Tempo
            </h2>
            <CaseTimeline events={timeline} />
          </div>

          {/* Urgent CTA */}
          <div
            className="mt-8 p-6 rounded-xl"
            style={{
              backgroundColor: '#FFF8F7',
              border: '1px solid var(--color-coral-hope)',
            }}
          >
            <p
              className="text-base font-semibold mb-1"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
            >
              Viu esta criança? Reporte agora.
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              Cada informação pode fazer a diferença.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/report-sighting?caseId=${caseData.id}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold text-sm transition-all"
                style={{
                  backgroundColor: 'var(--color-coral-hope)',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                Reportar Avistamento
              </Link>
              <div>
                <ShareButtons
                  caseId={caseData.id}
                  caseName={personName}
                  caseNumber={caseData.caseNumber}
                />
              </div>
            </div>
          </div>

          {/* Source attribution */}
          <div
            className="mt-6 px-4 py-3 rounded-xl flex flex-wrap items-center justify-between gap-3"
            style={{
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-primary)',
            }}
          >
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Fonte:{' '}
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {SOURCE_LABELS[caseData.source] ?? caseData.source}
              </span>
            </p>
            <div className="flex items-center gap-4">
              <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                Qualidade dos dados:{' '}
                <span style={{ color: 'var(--color-deep-indigo)', fontWeight: 700 }}>
                  {caseData.dataQuality}%
                </span>
              </p>
              {caseData.sourceUrl && (
                <a
                  href={caseData.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs transition-colors"
                  style={{ color: 'var(--color-data-blue)' }}
                >
                  Ver fonte original →
                </a>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
