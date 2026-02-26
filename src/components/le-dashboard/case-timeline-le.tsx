'use client'

import { useState } from 'react'

// =============================================================
// Case Timeline LE — Detailed timeline for Law Enforcement
// Includes internal notes + restricted data not visible to public
// Sprint 6, E7-S03
// =============================================================

type TimelineEventType =
  | 'case_opened'
  | 'data_ingested'
  | 'sighting_reported'
  | 'face_match_found'
  | 'alert_sent'
  | 'field_investigation'
  | 'internal_note'
  | 'status_change'
  | 'media_broadcast'
  | 'case_resolved'
  | 'case_closed'

interface TimelineEvent {
  id: string
  type: TimelineEventType
  timestamp: string
  title: string
  description: string
  author?: string
  authorRole?: string
  isInternal?: boolean
  metadata?: Record<string, string | number>
  attachmentCount?: number
}

interface CaseTimelineLeProps {
  caseId: string
  events?: TimelineEvent[]
  onAddNote?: (note: string) => Promise<void>
  showInternalOnly?: boolean
}

const EVENT_CONFIG: Record<
  TimelineEventType,
  { icon: string; color: string; label: string; bgColor: string }
> = {
  case_opened: {
    icon: '📋',
    color: 'var(--color-deep-indigo)',
    bgColor: 'rgba(45, 53, 97, 0.08)',
    label: 'Caso Aberto',
  },
  data_ingested: {
    icon: '🔄',
    color: 'var(--color-data-blue)',
    bgColor: 'var(--color-data-blue-light)',
    label: 'Dados Ingeridos',
  },
  sighting_reported: {
    icon: '👁',
    color: 'var(--color-alert-amber)',
    bgColor: 'rgba(245, 158, 11, 0.08)',
    label: 'Avistamento Reportado',
  },
  face_match_found: {
    icon: '🎯',
    color: 'var(--color-coral-hope)',
    bgColor: 'rgba(232, 99, 74, 0.08)',
    label: 'Correspondência Facial',
  },
  alert_sent: {
    icon: '📡',
    color: 'var(--color-alert-amber)',
    bgColor: 'rgba(245, 158, 11, 0.08)',
    label: 'Alerta Enviado',
  },
  field_investigation: {
    icon: '🔍',
    color: 'var(--color-deep-indigo)',
    bgColor: 'rgba(45, 53, 97, 0.08)',
    label: 'Investigação de Campo',
  },
  internal_note: {
    icon: '🔒',
    color: 'var(--color-text-muted)',
    bgColor: 'var(--color-bg-tertiary)',
    label: 'Nota Interna',
  },
  status_change: {
    icon: '🏷',
    color: 'var(--color-data-blue)',
    bgColor: 'var(--color-data-blue-light)',
    label: 'Mudança de Status',
  },
  media_broadcast: {
    icon: '📺',
    color: 'var(--color-coral-hope)',
    bgColor: 'rgba(232, 99, 74, 0.08)',
    label: 'Alerta Âmbar / Mídia',
  },
  case_resolved: {
    icon: '✅',
    color: 'var(--color-found-green)',
    bgColor: 'var(--color-found-green-light)',
    label: 'Caso Resolvido',
  },
  case_closed: {
    icon: '🗃',
    color: 'var(--color-text-muted)',
    bgColor: 'var(--color-bg-tertiary)',
    label: 'Caso Encerrado',
  },
}

// Mock timeline events for demo
const MOCK_EVENTS: TimelineEvent[] = [
  {
    id: 'e1',
    type: 'case_opened',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    title: 'Caso registrado pela família',
    description: 'Ana Silva, 8 anos. Reportado pela mãe Renata Silva via portal público.',
    author: 'Sistema',
    authorRole: 'Automated',
    metadata: { caseNumber: 'BR-2026-001' },
  },
  {
    id: 'e2',
    type: 'data_ingested',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
    title: 'Dados enviados para base federal',
    description: 'Caso normalizado e indexado. Embedding facial gerado (ArcFace, 512-dim).',
    author: 'Pipeline de Ingestão',
    authorRole: 'Automated',
    metadata: { embeddingQuality: '94%', sources: 2 },
  },
  {
    id: 'e3',
    type: 'field_investigation',
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    title: 'Diligência na escola — sem localizar',
    description:
      'Agentes foram à Escola Municipal Bela Vista. Última presença registrada: terça-feira, 08h30. Câmeras sem imagens nítidas.',
    author: 'Det. Carlos Lima',
    authorRole: 'law_enforcement',
    isInternal: true,
    metadata: { location: 'Escola Municipal Bela Vista, SP' },
  },
  {
    id: 'e4',
    type: 'alert_sent',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    title: 'Alerta WhatsApp — 1.842 destinatários',
    description: 'Alerta de desaparecimento enviado via WhatsApp Business API para assinantes no raio de 50km.',
    author: 'Det. Carlos Lima',
    authorRole: 'law_enforcement',
    metadata: { recipients: 1842, radius: '50km', channel: 'WhatsApp' },
  },
  {
    id: 'e5',
    type: 'sighting_reported',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    title: 'Avistamento via app — Parque Ibirapuera',
    description:
      'Cidadão reportou criança com descrição similar no Parque Ibirapuera às 14h22. GPS confirmado: -23.5873, -46.6580.',
    author: 'Cidadão Anônimo',
    metadata: { lat: -23.5873, lng: -46.658, confidence: 'Provável' },
  },
  {
    id: 'e6',
    type: 'face_match_found',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
    title: 'Correspondência facial — Similaridade 84.7%',
    description:
      'Sistema identificou correspondência HIGH na foto do avistamento. Pendente validação HITL pelo operador.',
    author: 'Face Match Engine',
    authorRole: 'Automated',
    metadata: { similarity: '84.7%', threshold: 'HIGH (>=85%)', status: 'Aguardando HITL' },
  },
  {
    id: 'e7',
    type: 'internal_note',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
    title: 'Nota interna — Confirmação HITL',
    description:
      'Revisão humana concluída. Correspondência confirmada com 87% de confiança subjetiva. Enviando equipe de campo para Ibirapuera.',
    author: 'Op. Julia Santos',
    authorRole: 'law_enforcement',
    isInternal: true,
  },
  {
    id: 'e8',
    type: 'media_broadcast',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    title: 'Alerta Âmbar emitido — TV/Rádio',
    description:
      'Alerta Âmbar aprovado por Det. Supervisor Lima. Transmitido para 3 emissoras de TV e 7 rádios na região metropolitana.',
    author: 'Det. Supervisor Lima',
    authorRole: 'law_enforcement',
    metadata: { tvStations: 3, radioStations: 7, coverage: 'Região Metropolitana SP' },
  },
]

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 2) return 'agora mesmo'
  if (minutes < 60) return `${minutes} min atrás`
  if (hours < 24) return `${hours}h atrás`
  if (days === 1) return 'ontem'
  return `${days} dias atrás`
}

function formatFullDate(isoString: string): string {
  return new Date(isoString).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function CaseTimelineLe({
  caseId,
  events = MOCK_EVENTS,
  onAddNote,
  showInternalOnly = false,
}: CaseTimelineLeProps) {
  const [filter, setFilter] = useState<'all' | 'public' | 'internal'>('all')
  const [noteText, setNoteText] = useState('')
  const [isSubmittingNote, setIsSubmittingNote] = useState(false)
  const [noteSuccess, setNoteSuccess] = useState(false)

  const filteredEvents = events.filter((event) => {
    if (filter === 'internal') return event.isInternal
    if (filter === 'public') return !event.isInternal
    return true
  })

  const handleAddNote = async () => {
    if (!noteText.trim() || !onAddNote) return
    setIsSubmittingNote(true)
    try {
      await onAddNote(noteText.trim())
      setNoteText('')
      setNoteSuccess(true)
      setTimeout(() => setNoteSuccess(false), 3000)
    } catch {
      // Error is handled by parent
    } finally {
      setIsSubmittingNote(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header + filter tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3
            className="font-semibold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            Linha do Tempo
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Caso{' '}
            <span style={{ fontFamily: 'var(--font-mono)' }}>{caseId}</span>
          </p>
        </div>
        <div
          className="flex rounded-lg border overflow-hidden text-xs"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {(['all', 'public', 'internal'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 font-medium transition-colors"
              style={{
                backgroundColor: filter === f ? 'var(--color-deep-indigo)' : 'var(--color-bg-primary)',
                color: filter === f ? '#fff' : 'var(--color-text-secondary)',
                borderRight: f !== 'internal' ? '1px solid var(--color-border)' : undefined,
              }}
            >
              {f === 'all' ? 'Todos' : f === 'public' ? 'Público' : 'Interno 🔒'}
            </button>
          ))}
        </div>
      </div>

      {/* Add internal note */}
      {onAddNote && (
        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--color-bg-tertiary)',
            borderColor: 'var(--color-border)',
          }}
        >
          <p className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
            <span>🔒</span> Adicionar nota interna (visível apenas para LE)
          </p>
          <div className="flex gap-2">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Registre observações de campo, contatos, próximos passos..."
              rows={2}
              className="flex-1 border rounded-lg px-3 py-2 text-sm resize-none"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
              }}
            />
            <button
              onClick={handleAddNote}
              disabled={!noteText.trim() || isSubmittingNote}
              className="px-4 text-sm font-medium rounded-lg text-white transition-all disabled:opacity-50 self-end"
              style={{ backgroundColor: 'var(--color-deep-indigo)', paddingBottom: '8px', paddingTop: '8px' }}
            >
              {isSubmittingNote ? '...' : 'Salvar'}
            </button>
          </div>
          {noteSuccess && (
            <p className="text-xs mt-1.5" style={{ color: 'var(--color-found-green)' }}>
              Nota registrada com sucesso.
            </p>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div
          className="absolute left-5 top-0 bottom-0 w-0.5"
          style={{ backgroundColor: 'var(--color-border)' }}
        />

        <div className="space-y-1">
          {filteredEvents.length === 0 ? (
            <div className="py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
              <p className="text-2xl mb-2">📭</p>
              <p className="text-sm">Nenhum evento nesta categoria.</p>
            </div>
          ) : (
            filteredEvents.map((event, index) => {
              const config = EVENT_CONFIG[event.type]
              const isLast = index === filteredEvents.length - 1

              return (
                <div key={event.id} className="relative flex gap-4" style={{ paddingBottom: isLast ? 0 : '16px' }}>
                  {/* Dot */}
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm"
                      style={{
                        backgroundColor: config.bgColor,
                        border: `2px solid ${config.color}`,
                      }}
                    >
                      {config.icon}
                    </div>
                  </div>

                  {/* Content */}
                  <div
                    className="flex-1 rounded-xl border p-4 min-w-0"
                    style={{
                      backgroundColor: event.isInternal ? 'var(--color-bg-tertiary)' : 'var(--color-bg-primary)',
                      borderColor: event.isInternal ? 'var(--color-border)' : 'var(--color-border)',
                      borderLeft: event.isInternal ? `3px solid var(--color-text-muted)` : `3px solid ${config.color}`,
                    }}
                  >
                    {/* Event header */}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: config.bgColor,
                            color: config.color,
                          }}
                        >
                          {config.label}
                        </span>
                        {event.isInternal && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: 'var(--color-bg-secondary)',
                              color: 'var(--color-text-muted)',
                              border: '1px solid var(--color-border)',
                            }}
                          >
                            🔒 Interno
                          </span>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p
                          className="text-xs"
                          title={formatFullDate(event.timestamp)}
                          style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
                        >
                          {formatRelativeTime(event.timestamp)}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                      {event.title}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {event.description}
                    </p>

                    {/* Metadata chips */}
                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        {Object.entries(event.metadata).map(([key, value]) => (
                          <span
                            key={key}
                            className="text-xs px-2 py-0.5 rounded-md"
                            style={{
                              backgroundColor: 'var(--color-bg-secondary)',
                              color: 'var(--color-text-muted)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Author */}
                    {event.author && (
                      <p
                        className="text-xs mt-2"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        Por: {event.author}
                        {event.authorRole && event.authorRole !== 'Automated' && (
                          <span className="ml-1">· {event.authorRole}</span>
                        )}
                        <span className="ml-2 opacity-70">{formatFullDate(event.timestamp)}</span>
                      </p>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
        {filteredEvents.length} evento{filteredEvents.length !== 1 ? 's' : ''} exibido
        {filteredEvents.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
