// =============================================================
// Skip Link Component (E8-S06 — Sprint 7 Accessibility)
// Allows keyboard users to skip navigation to main content
// CSS is in globals.css (.skip-link selector)
// =============================================================

interface SkipLinkProps {
  href?: string
  label?: string
}

export function SkipLink({
  href = '#main-content',
  label = 'Ir para conteúdo principal',
}: SkipLinkProps) {
  return (
    <a href={href} className="skip-link">
      {label}
    </a>
  )
}

export default SkipLink
