import { clsx } from 'clsx'
import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'

// =============================================================
// Badge Component — ReunIA Design System (E1-S08)
// Used for case urgency, status, data sources, roles
// =============================================================

const badgeVariants = cva(
  [
    'inline-flex items-center gap-1',
    'px-2.5 py-0.5 rounded-full',
    'text-xs font-medium',
    'border',
  ],
  {
    variants: {
      variant: {
        // Case urgency
        critical: 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]',
        high: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]',
        standard: 'bg-[#DBEAFE] text-[#1D4ED8] border-[#93C5FD]',
        low: 'bg-[#F3F4F6] text-[#4B5563] border-[#D1D5DB]',

        // Case status
        active: 'bg-[#D1FAE5] text-[#047857] border-[#6EE7B7]',
        resolved: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
        pending: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]',
        archived: 'bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]',

        // Source
        source: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',

        // Role
        admin: 'bg-[#2D3561] text-white border-transparent',
        law_enforcement: 'bg-[#3B82F6] text-white border-transparent',
        ngo: 'bg-[#10B981] text-white border-transparent',
        family: 'bg-[#E8634A] text-white border-transparent',
        volunteer: 'bg-[#8B5CF6] text-white border-transparent',
        public: 'bg-[#6B7280] text-white border-transparent',

        // Confidence tiers (face match)
        confident: 'bg-[#D1FAE5] text-[#047857] border-[#6EE7B7]',
        likely: 'bg-[#DBEAFE] text-[#1D4ED8] border-[#93C5FD]',
        possible: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]',
      },
    },
    defaultVariants: {
      variant: 'standard',
    },
  }
)

// Dot indicator
const dotColors: Record<string, string> = {
  critical: '#DC2626',
  high: '#F59E0B',
  standard: '#3B82F6',
  low: '#9CA3AF',
  active: '#10B981',
  resolved: '#059669',
  pending: '#F59E0B',
  archived: '#9CA3AF',
}

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  withDot?: boolean
  label?: string // Screen reader label override
}

function Badge({ className, variant, withDot, children, label, ...props }: BadgeProps) {
  const dotColor = variant ? dotColors[variant] : undefined

  return (
    <span
      className={clsx(badgeVariants({ variant }), className)}
      aria-label={label}
      {...props}
    >
      {withDot && dotColor && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor }}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}

// Specialized urgency badge with localized labels
export function UrgencyBadge({
  urgency,
  className,
}: {
  urgency: 'critical' | 'high' | 'standard' | 'low'
  className?: string
}) {
  const labels = {
    critical: 'Crítico',
    high: 'Alto',
    standard: 'Padrão',
    low: 'Baixo',
  }

  return (
    <Badge
      variant={urgency}
      withDot
      className={className}
      label={`Urgência: ${labels[urgency]}`}
    >
      {labels[urgency]}
    </Badge>
  )
}

// Specialized status badge
export function StatusBadge({
  status,
  className,
}: {
  status: 'active' | 'resolved' | 'pending' | 'archived' | 'draft' | 'pending_review' | 'closed'
  className?: string
}) {
  const statusMap: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    active: { variant: 'active', label: 'Ativo' },
    resolved: { variant: 'resolved', label: 'Encontrado' },
    pending: { variant: 'pending', label: 'Pendente' },
    pending_review: { variant: 'pending', label: 'Em revisão' },
    draft: { variant: 'archived', label: 'Rascunho' },
    archived: { variant: 'archived', label: 'Arquivado' },
    closed: { variant: 'archived', label: 'Fechado' },
  }

  const { variant, label } = statusMap[status] ?? { variant: 'standard' as BadgeProps['variant'], label: status }

  return (
    <Badge variant={variant} withDot className={className} label={`Status: ${label}`}>
      {label}
    </Badge>
  )
}

export { Badge, badgeVariants }
