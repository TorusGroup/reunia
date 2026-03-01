'use client'

// =============================================================
// AvatarPlaceholder — Elegant avatar with initials and color
// derived from the person's name. Used when photo is unavailable
// or fails to load.
// =============================================================

// Palette of warm, accessible colors for avatar backgrounds
const AVATAR_COLORS = [
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#F43F5E', // rose
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#A855F7', // purple
  '#D946EF', // fuchsia
  '#0EA5E9', // sky
  '#10B981', // emerald
  '#F59E0B', // amber
]

function hashName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash // Convert to 32bit int
  }
  return Math.abs(hash)
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function getColor(name: string): string {
  return AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length]
}

interface AvatarPlaceholderProps {
  name: string
  size?: 'sm' | 'md' | 'lg' | 'full'
  className?: string
}

export function AvatarPlaceholder({ name, size = 'full', className = '' }: AvatarPlaceholderProps) {
  const initials = getInitials(name)
  const bgColor = getColor(name)

  const sizeConfig = {
    sm: { container: 'w-10 h-10', text: 'text-sm' },
    md: { container: 'w-14 h-14', text: 'text-base' },
    lg: { container: 'w-20 h-20', text: 'text-2xl' },
    full: { container: 'w-full h-full', text: 'text-3xl' },
  }

  const { container, text } = sizeConfig[size]

  return (
    <div
      className={`${container} flex items-center justify-center ${className}`}
      style={{
        backgroundColor: bgColor,
        backgroundImage: `linear-gradient(135deg, ${bgColor} 0%, ${bgColor}dd 100%)`,
      }}
      aria-label={`Avatar de ${name}`}
    >
      <span
        className={`${text} font-semibold text-white select-none`}
        style={{
          fontFamily: 'var(--font-heading)',
          textShadow: '0 1px 2px rgba(0,0,0,0.15)',
          letterSpacing: '0.05em',
        }}
      >
        {initials}
      </span>
    </div>
  )
}
