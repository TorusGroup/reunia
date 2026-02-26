'use client'

// =============================================================
// Pagination — URL-based cursor/page pagination (Sprint 4, E5)
// Active page: Coral Hope border+text
// =============================================================

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

export function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null

  // Generate page numbers with ellipsis
  const pages: (number | 'ellipsis')[] = []

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push('ellipsis')
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    if (currentPage < totalPages - 2) pages.push('ellipsis')
    pages.push(totalPages)
  }

  return (
    <nav
      aria-label="Navegação por páginas"
      className={`flex items-center justify-center gap-1 ${className ?? ''}`}
    >
      {/* Previous */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="flex items-center justify-center w-9 h-9 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-bg-primary)',
          fontFamily: 'var(--font-body)',
        }}
        aria-label="Página anterior"
      >
        ←
      </button>

      {pages.map((page, idx) =>
        page === 'ellipsis' ? (
          <span
            key={`ellipsis-${idx}`}
            className="w-9 h-9 flex items-center justify-center text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            …
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            aria-current={page === currentPage ? 'page' : undefined}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-sm font-medium transition-all"
            style={
              page === currentPage
                ? {
                    color: 'var(--color-coral-hope)',
                    border: '2px solid var(--color-coral-hope)',
                    backgroundColor: 'var(--color-bg-primary)',
                    fontFamily: 'var(--font-body)',
                  }
                : {
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg-primary)',
                    fontFamily: 'var(--font-body)',
                  }
            }
          >
            {page}
          </button>
        )
      )}

      {/* Next */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="flex items-center justify-center w-9 h-9 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-bg-primary)',
          fontFamily: 'var(--font-body)',
        }}
        aria-label="Próxima página"
      >
        →
      </button>
    </nav>
  )
}
