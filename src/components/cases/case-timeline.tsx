// =============================================================
// CaseTimeline — Horizontal (desktop) / Vertical (mobile) timeline
// Sprint 4, E5
// =============================================================

export interface TimelineEvent {
  id: string
  date: string
  title: string
  description?: string
  type: 'registered' | 'police_notified' | 'sighting' | 'match' | 'update' | 'resolved'
}

const EVENT_COLORS: Record<TimelineEvent['type'], string> = {
  registered: 'var(--color-data-blue)',
  police_notified: 'var(--color-deep-indigo)',
  sighting: 'var(--color-alert-amber)',
  match: 'var(--color-coral-hope)',
  update: 'var(--color-warm-gray)',
  resolved: 'var(--color-found-green)',
}

interface CaseTimelineProps {
  events: TimelineEvent[]
}

export function CaseTimeline({ events }: CaseTimelineProps) {
  if (!events.length) return null

  return (
    <div
      aria-label="Linha do tempo do caso"
      role="list"
      className="relative"
    >
      {/* Vertical line */}
      <div
        className="absolute left-3.5 top-4 bottom-4 w-px"
        style={{ backgroundColor: 'var(--color-border)' }}
        aria-hidden="true"
      />

      <div className="space-y-4">
        {events.map((event) => {
          const dotColor = EVENT_COLORS[event.type]
          const date = new Date(event.date)
          const formattedDate = date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })

          return (
            <div
              key={event.id}
              className="flex items-start gap-4 relative"
              role="listitem"
            >
              {/* Dot */}
              <div
                className="relative z-10 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: `${dotColor}20`,
                  border: `2px solid ${dotColor}`,
                }}
                aria-hidden="true"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: dotColor }}
                />
              </div>

              {/* Content */}
              <div className="flex-1 pb-2">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p
                    className="font-semibold text-sm"
                    style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
                  >
                    {event.title}
                  </p>
                  <time
                    dateTime={event.date}
                    className="text-xs"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
                  >
                    {formattedDate}
                  </time>
                </div>
                {event.description && (
                  <p
                    className="text-sm mt-1"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {event.description}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
