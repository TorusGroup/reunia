import { type ReactNode, type ElementType, type CSSProperties } from 'react'

// =============================================================
// Screen Reader Only Component (E8-S06 — Sprint 7 Accessibility)
// Visually hidden but accessible to screen readers
// =============================================================

interface SrOnlyProps {
  children: ReactNode
  as?: ElementType
  id?: string
  role?: string
  'aria-live'?: 'polite' | 'assertive' | 'off'
  'aria-atomic'?: boolean
}

const srOnlyStyles: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
}

export function SrOnly({
  children,
  as: Tag = 'span',
  id,
  role,
  'aria-live': ariaLive,
  'aria-atomic': ariaAtomic,
}: SrOnlyProps) {
  return (
    <Tag
      id={id}
      role={role}
      aria-live={ariaLive}
      aria-atomic={ariaAtomic}
      style={srOnlyStyles}
    >
      {children}
    </Tag>
  )
}

// Live region for announcing dynamic changes to screen readers
export function LiveRegion({
  children,
  politeness = 'polite',
  atomic = true,
  id,
}: {
  children: ReactNode
  politeness?: 'polite' | 'assertive'
  atomic?: boolean
  id?: string
}) {
  return (
    <SrOnly
      id={id}
      role="status"
      aria-live={politeness}
      aria-atomic={atomic}
    >
      {children}
    </SrOnly>
  )
}

export default SrOnly
