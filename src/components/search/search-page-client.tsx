'use client'

// =============================================================
// SearchPageClient — Interactive search UI
// Filters sidebar + results list + pagination
// Sprint 4, E5
// =============================================================

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { SearchBar } from '@/components/search/search-bar'
import { SearchFilters } from '@/components/search/search-filters'
import { SearchResults } from '@/components/search/search-results'
import { Pagination } from '@/components/common/pagination'
import type { CaseSummary, CaseSearchFilters } from '@/types/cases'

// Mock data for Sprint 4 — will be replaced by API call in Sprint 5
const MOCK_CASES: CaseSummary[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    caseNumber: 'REUNIA-2026-000001',
    caseType: 'missing', status: 'active', urgency: 'high',
    reportedAt: '2026-02-24T00:00:00Z', lastSeenAt: '2026-02-24T14:30:00Z',
    lastSeenLocation: 'São Paulo, SP', lastSeenCountry: 'BR',
    source: 'platform', dataQuality: 85,
    persons: [{ id: 'p1', role: 'missing_child', firstName: 'Maria', lastName: 'Santos', approximateAge: 8, gender: 'female' }],
    createdAt: '2026-02-24T00:00:00Z', updatedAt: '2026-02-24T00:00:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    caseNumber: 'REUNIA-2026-000002',
    caseType: 'missing', status: 'active', urgency: 'critical',
    reportedAt: '2026-02-15T00:00:00Z', lastSeenAt: '2026-02-15T09:00:00Z',
    lastSeenLocation: 'Rio de Janeiro, RJ', lastSeenCountry: 'BR',
    source: 'ncmec', dataQuality: 92,
    persons: [{ id: 'p2', role: 'missing_child', firstName: 'João', lastName: 'Pereira', approximateAge: 12, gender: 'male' }],
    createdAt: '2026-02-15T00:00:00Z', updatedAt: '2026-02-15T00:00:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    caseNumber: 'REUNIA-2026-000003',
    caseType: 'missing', status: 'active', urgency: 'high',
    reportedAt: '2026-02-25T00:00:00Z', lastSeenAt: '2026-02-25T16:00:00Z',
    lastSeenLocation: 'Campinas, SP', lastSeenCountry: 'BR',
    source: 'platform', dataQuality: 78,
    persons: [{ id: 'p3', role: 'missing_child', firstName: 'Ana', lastName: 'Lima', approximateAge: 6, gender: 'female' }],
    createdAt: '2026-02-25T00:00:00Z', updatedAt: '2026-02-25T00:00:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    caseNumber: 'REUNIA-2026-000004',
    caseType: 'missing', status: 'active', urgency: 'standard',
    reportedAt: '2026-02-19T00:00:00Z', lastSeenAt: '2026-02-19T11:00:00Z',
    lastSeenLocation: 'Brasília, DF', lastSeenCountry: 'BR',
    source: 'fbi', dataQuality: 88,
    persons: [{ id: 'p4', role: 'missing_child', firstName: 'Pedro', lastName: 'Mendes', approximateAge: 14, gender: 'male' }],
    createdAt: '2026-02-19T00:00:00Z', updatedAt: '2026-02-19T00:00:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440005',
    caseNumber: 'REUNIA-2026-000005',
    caseType: 'missing', status: 'active', urgency: 'high',
    reportedAt: '2026-02-23T00:00:00Z', lastSeenAt: '2026-02-23T08:00:00Z',
    lastSeenLocation: 'Belo Horizonte, MG', lastSeenCountry: 'BR',
    source: 'disque100', dataQuality: 80,
    persons: [{ id: 'p5', role: 'missing_child', firstName: 'Luiza', lastName: 'Costa', approximateAge: 10, gender: 'female' }],
    createdAt: '2026-02-23T00:00:00Z', updatedAt: '2026-02-23T00:00:00Z',
  },
]

interface SearchPageClientProps {
  initialQuery: string
  initialPage: number
}

export function SearchPageClient({ initialQuery, initialPage }: SearchPageClientProps) {
  const [query, setQuery] = useState(initialQuery)
  const [filters, setFilters] = useState<CaseSearchFilters>({})
  const [isLoading, setIsLoading] = useState(false)
  const [cases, setCases] = useState<CaseSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(initialPage)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const router = useRouter()
  const pathname = usePathname()

  const LIMIT = 10
  const totalPages = Math.ceil(total / LIMIT)

  // Filter + search mock data
  const runSearch = useCallback((q: string, f: CaseSearchFilters, p: number) => {
    setIsLoading(true)
    // Simulate network delay
    setTimeout(() => {
      let results = [...MOCK_CASES]

      if (q) {
        const lower = q.toLowerCase()
        results = results.filter((c) =>
          c.persons.some((person) => {
            const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.toLowerCase()
            return name.includes(lower) || c.caseNumber.toLowerCase().includes(lower)
          })
        )
      }

      if (f.source) results = results.filter((c) => c.source === f.source)
      if (f.status) results = results.filter((c) => c.status === f.status)
      if (f.gender) results = results.filter((c) => c.persons.some((person) => person.gender === f.gender))
      if (f.ageMin != null) results = results.filter((c) => c.persons.some((p) => (p.approximateAge ?? 0) >= f.ageMin!))
      if (f.ageMax != null) results = results.filter((c) => c.persons.some((p) => (p.approximateAge ?? 99) <= f.ageMax!))

      setTotal(results.length)
      setCases(results.slice((p - 1) * LIMIT, p * LIMIT))
      setIsLoading(false)
    }, 300)
  }, [])

  useEffect(() => {
    runSearch(query, filters, page)
  }, [query, filters, page, runSearch])

  function handleSearch(q: string) {
    setQuery(q)
    setPage(1)
    // Update URL
    const url = q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname
    router.push(url, { scroll: false })
  }

  function handleFilterChange(changed: Partial<CaseSearchFilters>) {
    setFilters((prev) => ({ ...prev, ...changed }))
    setPage(1)
  }

  function handleClearFilters() {
    setFilters({})
    setPage(1)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Search bar header */}
      <div
        className="sticky top-16 z-30 py-3"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        <SearchBar
          defaultValue={query}
          size="compact"
          onSearch={handleSearch}
          showClearButton
        />
      </div>

      {/* Results header */}
      <div className="flex items-center justify-between mt-4 mb-4">
        <p
          className="text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-live="polite"
          aria-atomic="true"
        >
          {isLoading
            ? 'Buscando...'
            : query
            ? `${total} resultado${total !== 1 ? 's' : ''} para "${query}"`
            : `${total} caso${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
        </p>

        {/* Mobile filters toggle */}
        <button
          onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium md:hidden"
          style={{
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="4" y1="6" x2="11" y2="6" /><line x1="13" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="8" y2="12" /><line x1="10" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="14" y2="18" /><line x1="16" y1="18" x2="20" y2="18" />
          </svg>
          Filtros
        </button>
      </div>

      {/* Mobile filters drawer */}
      {mobileFiltersOpen && (
        <div
          className="md:hidden mb-4 p-4 rounded-xl"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
          }}
        >
          <SearchFilters
            filters={filters}
            onChange={handleFilterChange}
            onClear={handleClearFilters}
          />
        </div>
      )}

      <div className="flex gap-6">
        {/* Filters sidebar — desktop */}
        <aside
          className="hidden md:block w-60 flex-shrink-0 sticky"
          style={{ top: '108px', alignSelf: 'flex-start' }}
        >
          <div
            className="p-4 rounded-xl"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <SearchFilters
              filters={filters}
              onChange={handleFilterChange}
              onClear={handleClearFilters}
            />
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          <SearchResults
            cases={cases}
            total={total}
            isLoading={isLoading}
            query={query}
          />

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className="mt-8">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={(p) => {
                  setPage(p)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
