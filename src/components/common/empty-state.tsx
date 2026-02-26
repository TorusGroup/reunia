// =============================================================
// EmptyState — Illustrated empty states (Sprint 4, E5)
// Uses silhouette + helpful message, never generic
// =============================================================

import Link from 'next/link'

interface EmptyStateAction {
  label: string
  href: string
}

interface EmptyStateProps {
  title: string
  description: string
  action?: EmptyStateAction
  icon?: 'search' | 'cases' | 'alerts'
}

function SearchIcon() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="28" cy="28" r="18" stroke="var(--color-border)" strokeWidth="3" />
      <line
        x1="42"
        y1="42"
        x2="56"
        y2="56"
        stroke="var(--color-border)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Magnifying glass center — child silhouette suggestion */}
      <circle cx="28" cy="24" r="5" fill="var(--color-bg-tertiary)" />
      <path
        d="M18 36c0-5.523 4.477-10 10-10s10 4.477 10 10"
        stroke="var(--color-bg-tertiary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

function CasesIcon() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      {/* Simple file/folder icon */}
      <rect x="8" y="16" width="48" height="40" rx="4" stroke="var(--color-border)" strokeWidth="3" />
      <path
        d="M8 24h48"
        stroke="var(--color-border)"
        strokeWidth="2"
      />
      <rect x="16" y="32" width="32" height="3" rx="1.5" fill="var(--color-bg-tertiary)" />
      <rect x="16" y="40" width="24" height="3" rx="1.5" fill="var(--color-bg-tertiary)" />
      <rect x="16" y="48" width="20" height="3" rx="1.5" fill="var(--color-bg-tertiary)" />
    </svg>
  )
}

function AlertsIcon() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M32 8L6 52h52L32 8z"
        stroke="var(--color-border)"
        strokeWidth="3"
        strokeLinejoin="round"
        fill="var(--color-bg-tertiary)"
      />
      <rect x="29" y="28" width="6" height="14" rx="3" fill="var(--color-warm-gray)" />
      <circle cx="32" cy="46" r="3" fill="var(--color-warm-gray)" />
    </svg>
  )
}

export function EmptyState({ title, description, action, icon = 'search' }: EmptyStateProps) {
  const icons = {
    search: <SearchIcon />,
    cases: <CasesIcon />,
    alerts: <AlertsIcon />,
  }

  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
      role="status"
    >
      <div className="mb-6 opacity-60">{icons[icon]}</div>
      <h3
        className="text-lg font-semibold mb-2"
        style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
      >
        {title}
      </h3>
      <p
        className="text-sm max-w-sm leading-relaxed mb-6"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {description}
      </p>
      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center gap-2 text-sm font-semibold transition-colors"
          style={{ color: 'var(--color-coral-hope)', fontFamily: 'var(--font-heading)' }}
        >
          {action.label}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}
    </div>
  )
}
