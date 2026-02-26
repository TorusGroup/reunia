'use client'

// =============================================================
// FamilyDashboard — Family portal: my cases, sightings, notifications
// Sprint 4, E5-S06 (mock data; real API in Sprint 5)
// =============================================================

import type React from 'react'
import { useState } from 'react'
import Link from 'next/link'
import type { CaseSummary, CaseStatus } from '@/types/cases'

// ---------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------

interface Sighting {
  id: string
  caseId: string
  childName: string
  reportedAt: string
  location: string
  confidence: 'high' | 'medium' | 'low'
  description: string
  reviewed: boolean
}

interface Notification {
  id: string
  type: 'sighting' | 'status_change' | 'match' | 'info'
  title: string
  body: string
  createdAt: string
  read: boolean
  caseId?: string
}

const MOCK_CASES: Array<CaseSummary & { childName: string; daysOpen: number }> = [
  {
    id: 'case-001',
    caseNumber: 'RUN-2026-00421',
    caseType: 'missing',
    status: 'active',
    urgency: 'critical',
    reportedAt: '2026-02-10T08:30:00Z',
    lastSeenAt: '2026-02-10T07:00:00Z',
    lastSeenLocation: 'Praça da Sé, São Paulo, SP',
    lastSeenCountry: 'BR',
    source: 'platform',
    dataQuality: 88,
    persons: [
      {
        id: 'person-001a',
        role: 'missing_child',
        firstName: 'Sofia',
        lastName: 'Pereira',
        approximateAge: 9,
        gender: 'female',
        primaryImageUrl: undefined,
      },
    ],
    createdAt: '2026-02-10T08:30:00Z',
    updatedAt: '2026-02-26T14:00:00Z',
    childName: 'Sofia Pereira',
    daysOpen: 17,
  },
  {
    id: 'case-002',
    caseNumber: 'RUN-2026-00387',
    caseType: 'runaway',
    status: 'active',
    urgency: 'high',
    reportedAt: '2026-02-18T14:00:00Z',
    lastSeenAt: '2026-02-18T12:30:00Z',
    lastSeenLocation: 'Terminal Pinheiros, São Paulo, SP',
    lastSeenCountry: 'BR',
    source: 'platform',
    dataQuality: 74,
    persons: [
      {
        id: 'person-002a',
        role: 'missing_child',
        firstName: 'Gabriel',
        lastName: 'Mendes',
        approximateAge: 14,
        gender: 'male',
        primaryImageUrl: undefined,
      },
    ],
    createdAt: '2026-02-18T14:00:00Z',
    updatedAt: '2026-02-27T09:00:00Z',
    childName: 'Gabriel Mendes',
    daysOpen: 9,
  },
  {
    id: 'case-003',
    caseNumber: 'RUN-2025-04812',
    caseType: 'abduction_family',
    status: 'resolved',
    urgency: 'standard',
    reportedAt: '2025-11-03T10:00:00Z',
    lastSeenAt: '2025-11-03T09:00:00Z',
    lastSeenLocation: 'Aeroporto GRU, Guarulhos, SP',
    lastSeenCountry: 'BR',
    source: 'platform',
    dataQuality: 91,
    persons: [
      {
        id: 'person-003a',
        role: 'missing_child',
        firstName: 'Isabela',
        lastName: 'Costa',
        approximateAge: 6,
        gender: 'female',
        primaryImageUrl: undefined,
      },
    ],
    createdAt: '2025-11-03T10:00:00Z',
    updatedAt: '2025-11-28T16:00:00Z',
    childName: 'Isabela Costa',
    daysOpen: 25,
  },
]

const MOCK_SIGHTINGS: Sighting[] = [
  {
    id: 'sight-001',
    caseId: 'case-001',
    childName: 'Sofia Pereira',
    reportedAt: '2026-02-26T18:45:00Z',
    location: 'Mercado Municipal, São Paulo, SP',
    confidence: 'medium',
    description: 'Criança de cabelo escuro, sozinha, olhando para o mercado. Corresponde à descrição.',
    reviewed: false,
  },
  {
    id: 'sight-002',
    caseId: 'case-001',
    childName: 'Sofia Pereira',
    reportedAt: '2026-02-25T11:20:00Z',
    location: 'Parque Trianon, São Paulo, SP',
    confidence: 'low',
    description: 'Possível avistamento perto dos brinquedos. Visibilidade baixa, fotos enviadas.',
    reviewed: true,
  },
  {
    id: 'sight-003',
    caseId: 'case-002',
    childName: 'Gabriel Mendes',
    reportedAt: '2026-02-27T07:15:00Z',
    location: 'Consolação, São Paulo, SP',
    confidence: 'high',
    description: 'Adolescente com mochila preta visto dormindo em banco de praça. Descrição física compatível.',
    reviewed: false,
  },
]

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-001',
    type: 'sighting',
    title: 'Novo avistamento: Sofia Pereira',
    body: 'Um avistamento com confiança média foi registrado no Mercado Municipal. Aguarda sua revisão.',
    createdAt: '2026-02-26T18:46:00Z',
    read: false,
    caseId: 'case-001',
  },
  {
    id: 'notif-002',
    type: 'sighting',
    title: 'Avistamento de alta confiança: Gabriel Mendes',
    body: 'Um avistamento com confiança alta foi registrado na Consolação. Por favor, verifique imediatamente.',
    createdAt: '2026-02-27T07:16:00Z',
    read: false,
    caseId: 'case-002',
  },
  {
    id: 'notif-003',
    type: 'match',
    title: 'Possível correspondência facial: Sofia Pereira',
    body: 'O sistema identificou uma possível correspondência facial em imagem de câmera pública (67% confiança). Um operador está validando.',
    createdAt: '2026-02-26T14:00:00Z',
    read: true,
    caseId: 'case-001',
  },
  {
    id: 'notif-004',
    type: 'status_change',
    title: 'Caso atualizado: Isabela Costa',
    body: 'O caso de Isabela Costa foi marcado como Resolvido pela equipe. Isabela está em segurança.',
    createdAt: '2025-11-28T16:01:00Z',
    read: true,
    caseId: 'case-003',
  },
  {
    id: 'notif-005',
    type: 'info',
    title: 'Seu caso foi verificado',
    body: 'O caso de Sofia Pereira foi revisado por nossa equipe e está ativo no sistema. Compartilhe o link público para ampliar o alcance.',
    createdAt: '2026-02-10T10:00:00Z',
    read: true,
    caseId: 'case-001',
  },
]

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `há ${diffMins} min`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `há ${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `há ${diffDays} dia${diffDays !== 1 ? 's' : ''}`
  const diffMonths = Math.floor(diffDays / 30)
  return `há ${diffMonths} ${diffMonths !== 1 ? 'meses' : 'mês'}`
}

function getStatusLabel(status: CaseStatus): string {
  const labels: Record<CaseStatus, string> = {
    draft: 'Rascunho',
    pending_review: 'Em revisão',
    active: 'Ativo',
    resolved: 'Resolvido',
    closed: 'Encerrado',
    archived: 'Arquivado',
  }
  return labels[status] ?? status
}

function getStatusStyle(status: CaseStatus): React.CSSProperties {
  switch (status) {
    case 'active':
      return { backgroundColor: 'var(--color-found-green-light)', color: 'var(--color-found-green)' }
    case 'resolved':
      return { backgroundColor: 'var(--color-data-blue-light)', color: 'var(--color-data-blue-dark)' }
    case 'pending_review':
      return { backgroundColor: '#FEF3C7', color: '#92400E' }
    default:
      return { backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-muted)' }
  }
}

function getUrgencyStyle(urgency: string): React.CSSProperties {
  switch (urgency) {
    case 'critical':
      return { backgroundColor: '#FFF0ED', color: 'var(--color-coral-hope)' }
    case 'high':
      return { backgroundColor: '#FEF3C7', color: '#92400E' }
    default:
      return { backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-muted)' }
  }
}

function getConfidenceStyle(confidence: 'high' | 'medium' | 'low'): React.CSSProperties {
  switch (confidence) {
    case 'high':
      return { color: 'var(--color-found-green)' }
    case 'medium':
      return { color: '#D97706' }
    case 'low':
      return { color: 'var(--color-text-muted)' }
  }
}

function getNotifIcon(type: Notification['type']): string {
  switch (type) {
    case 'sighting': return '👁'
    case 'match': return '🔍'
    case 'status_change': return '✅'
    case 'info': return 'ℹ️'
  }
}

// ---------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------

function PersonSilhouette({ gender }: { gender?: string }) {
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
      aria-hidden="true"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5">
        <circle cx="12" cy="8" r="4" />
        <path d={gender === 'female' ? 'M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6' : 'M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7'} />
      </svg>
    </div>
  )
}

function CaseRow({ c }: { c: typeof MOCK_CASES[0] }) {
  const child = c.persons[0]
  return (
    <Link
      href={`/case/${c.id}`}
      className="flex items-center gap-4 p-4 rounded-xl transition-all group"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border)',
      }}
      aria-label={`Ver caso de ${c.childName}, ${getStatusLabel(c.status)}`}
    >
      <PersonSilhouette gender={child?.gender} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="font-semibold text-sm truncate"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
          >
            {c.childName}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={getStatusStyle(c.status)}
          >
            {getStatusLabel(c.status)}
          </span>
          {c.status === 'active' && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={getUrgencyStyle(c.urgency)}
            >
              {c.urgency === 'critical' ? 'Crítico' : c.urgency === 'high' ? 'Alta prioridade' : 'Padrão'}
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
          {c.caseNumber} · {c.lastSeenLocation ?? 'Localização não informada'}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {c.status === 'active'
            ? `${c.daysOpen} dia${c.daysOpen !== 1 ? 's' : ''} aberto`
            : `Atualizado ${formatRelativeTime(c.updatedAt)}`}
        </p>
      </div>

      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-text-muted)"
        strokeWidth="2"
        className="flex-shrink-0 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      >
        <polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}

function SightingCard({ s }: { s: Sighting }) {
  const confidenceLabel = s.confidence === 'high' ? 'Alta' : s.confidence === 'medium' ? 'Média' : 'Baixa'
  return (
    <div
      className="p-4 rounded-xl"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: s.reviewed ? '1px solid var(--color-border)' : '1px solid var(--color-coral-hope)',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div>
          <span
            className="text-sm font-semibold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
          >
            {s.childName}
          </span>
          {!s.reviewed && (
            <span
              className="ml-2 text-xs px-1.5 py-0.5 rounded font-medium"
              style={{ backgroundColor: '#FFF0ED', color: 'var(--color-coral-hope)' }}
            >
              Novo
            </span>
          )}
        </div>
        <span className="text-xs flex-shrink-0" style={getConfidenceStyle(s.confidence)}>
          Confiança {confidenceLabel}
        </span>
      </div>
      <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="inline mr-1"
          aria-hidden="true"
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        {s.location}
      </p>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
        {s.description}
      </p>
      <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
        {formatRelativeTime(s.reportedAt)}
      </p>
    </div>
  )
}

function NotificationItem({ n, onRead }: { n: Notification; onRead: (id: string) => void }) {
  return (
    <button
      onClick={() => onRead(n.id)}
      className="w-full text-left flex items-start gap-3 p-3 rounded-lg transition-colors"
      style={{
        backgroundColor: n.read ? 'transparent' : 'var(--color-bg-secondary)',
      }}
    >
      <span className="text-base flex-shrink-0 mt-0.5" aria-hidden="true">
        {getNotifIcon(n.type)}
      </span>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium leading-snug"
          style={{
            color: 'var(--color-text-primary)',
            fontWeight: n.read ? 400 : 600,
          }}
        >
          {n.title}
        </p>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          {n.body}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {formatRelativeTime(n.createdAt)}
        </p>
      </div>
      {!n.read && (
        <div
          className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
          style={{ backgroundColor: 'var(--color-coral-hope)' }}
          aria-label="Não lida"
        />
      )}
    </button>
  )
}

// ---------------------------------------------------------------
// Main component
// ---------------------------------------------------------------

type Tab = 'cases' | 'sightings' | 'notifications'

export function FamilyDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('cases')
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS)

  const unreadCount = notifications.filter((n) => !n.read).length
  const newSightingsCount = MOCK_SIGHTINGS.filter((s) => !s.reviewed).length

  function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const activeCases = MOCK_CASES.filter((c) => c.status === 'active')
  const resolvedCases = MOCK_CASES.filter((c) => c.status === 'resolved' || c.status === 'closed')

  const tabs: Array<{ id: Tab; label: string; badge?: number }> = [
    { id: 'cases', label: 'Meus Casos', badge: activeCases.length > 0 ? activeCases.length : undefined },
    { id: 'sightings', label: 'Avistamentos', badge: newSightingsCount > 0 ? newSightingsCount : undefined },
    { id: 'notifications', label: 'Notificações', badge: unreadCount > 0 ? unreadCount : undefined },
  ]

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
        >
          Minha Área
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Acompanhe seus casos, avistamentos e notificações.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          {
            value: activeCases.length,
            label: 'Casos ativos',
            style: { color: 'var(--color-coral-hope)' },
          },
          {
            value: MOCK_SIGHTINGS.length,
            label: 'Avistamentos',
            style: { color: 'var(--color-found-green)' },
          },
          {
            value: unreadCount,
            label: 'Não lidas',
            style: { color: 'var(--color-data-blue)' },
          },
        ].map(({ value, label, style }) => (
          <div
            key={label}
            className="rounded-xl p-4 text-center"
            style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }}
          >
            <p
              className="text-2xl font-bold"
              style={{ fontFamily: 'var(--font-mono)', ...style }}
            >
              {value}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 mb-5 p-1 rounded-xl"
        style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }}
        role="tablist"
        aria-label="Seções do dashboard"
      >
        {tabs.map(({ id, label, badge }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all"
            style={
              activeTab === id
                ? {
                    backgroundColor: 'var(--color-bg-secondary)',
                    color: 'var(--color-deep-indigo)',
                    fontFamily: 'var(--font-heading)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  }
                : { color: 'var(--color-text-secondary)' }
            }
          >
            {label}
            {badge !== undefined && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full leading-none"
                style={{
                  backgroundColor: activeTab === id ? 'var(--color-coral-hope)' : 'var(--color-bg-tertiary)',
                  color: activeTab === id ? '#fff' : 'var(--color-text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {activeTab === 'cases' && (
        <section aria-labelledby="tab-cases">
          <h2 id="tab-cases" className="sr-only">Meus casos</h2>

          {/* Active cases */}
          {activeCases.length > 0 && (
            <div className="mb-6">
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-heading)' }}
              >
                Casos ativos
              </h3>
              <div className="space-y-2">
                {activeCases.map((c) => (
                  <CaseRow key={c.id} c={c} />
                ))}
              </div>
            </div>
          )}

          {/* Resolved cases */}
          {resolvedCases.length > 0 && (
            <div className="mb-6">
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-heading)' }}
              >
                Resolvidos
              </h3>
              <div className="space-y-2">
                {resolvedCases.map((c) => (
                  <CaseRow key={c.id} c={c} />
                ))}
              </div>
            </div>
          )}

          {/* Register new case CTA */}
          <div
            className="rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
            style={{
              backgroundColor: 'var(--color-data-blue-light)',
              border: '1px solid var(--color-data-blue)',
            }}
          >
            <div className="flex-1">
              <p
                className="text-sm font-semibold"
                style={{ color: 'var(--color-data-blue-dark)', fontFamily: 'var(--font-heading)' }}
              >
                Registrar novo caso
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-data-blue-dark)' }}>
                Caso tenha um novo desaparecimento para registrar, o processo leva cerca de 5 minutos.
              </p>
            </div>
            <Link
              href="/register-case"
              className="flex-shrink-0 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              style={{
                backgroundColor: 'var(--color-data-blue)',
                color: '#fff',
                fontFamily: 'var(--font-heading)',
              }}
            >
              Registrar caso
            </Link>
          </div>

          {/* CVV 188 — always visible */}
          <p className="text-xs text-center mt-6" style={{ color: 'var(--color-text-muted)' }}>
            Em emergência, ligue{' '}
            <a
              href="tel:190"
              className="font-bold"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-coral-hope)' }}
            >
              190
            </a>
            {' '}(Polícia) ou{' '}
            <a
              href="tel:188"
              className="font-bold"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-coral-hope)' }}
            >
              188
            </a>
            {' '}(CVV — apoio emocional 24h)
          </p>
        </section>
      )}

      {activeTab === 'sightings' && (
        <section aria-labelledby="tab-sightings">
          <h2 id="tab-sightings" className="sr-only">Avistamentos recentes</h2>

          {MOCK_SIGHTINGS.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Nenhum avistamento registrado ainda.
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Avistamentos reportados pela comunidade aparecerão aqui.
              </p>
            </div>
          ) : (
            <>
              {newSightingsCount > 0 && (
                <div
                  className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm"
                  style={{
                    backgroundColor: '#FFF0ED',
                    border: '1px solid var(--color-coral-hope)',
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--color-coral-hope)"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
                  </svg>
                  <span style={{ color: 'var(--color-coral-hope)', fontFamily: 'var(--font-heading)' }}>
                    {newSightingsCount} avistamento{newSightingsCount !== 1 ? 's' : ''} aguardando sua revisão
                  </span>
                </div>
              )}
              <div className="space-y-3">
                {MOCK_SIGHTINGS.map((s) => (
                  <SightingCard key={s.id} s={s} />
                ))}
              </div>
              <p className="text-xs text-center mt-4" style={{ color: 'var(--color-text-muted)' }}>
                Se reconhecer a criança em algum avistamento, entre em contato com a Polícia Civil imediatamente.
              </p>
            </>
          )}
        </section>
      )}

      {activeTab === 'notifications' && (
        <section aria-labelledby="tab-notifications">
          <h2 id="tab-notifications" className="sr-only">Notificações</h2>

          {unreadCount > 0 && (
            <div className="flex justify-end mb-3">
              <button
                onClick={markAllRead}
                className="text-xs transition-colors"
                style={{ color: 'var(--color-data-blue)' }}
              >
                Marcar todas como lidas
              </button>
            </div>
          )}

          <div
            className="rounded-xl divide-y overflow-hidden"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
            }}
          >
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Nenhuma notificação ainda.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <NotificationItem n={n} onRead={markRead} />
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  )
}
