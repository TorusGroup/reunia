'use client'

// =============================================================
// SearchPageClient — Interactive search UI
// Filters sidebar + results list + pagination
// Sprint 4 -> 5: Replaced mock data with live /api/v1/search calls
// =============================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { SearchBar } from '@/components/search/search-bar'
import { SearchFilters } from '@/components/search/search-filters'
import { SearchResults } from '@/components/search/search-results'
import { Pagination } from '@/components/common/pagination'
import type { CaseSummary, CaseSearchFilters } from '@/types/cases'

interface SearchPageClientProps {
  initialQuery: string
  initialPage: number
}

// ---------------------------------------------------------------
// Map API response to CaseSummary format
// ---------------------------------------------------------------
function mapApiResultToCaseSummary(result: Record<string, unknown>): CaseSummary {
  const persons = (result.persons as Array<Record<string, unknown>> | undefined) ?? []

  return {
    id: result.id as string,
    caseNumber: result.caseNumber as string,
    caseType: (result.caseType ?? 'missing') as CaseSummary['caseType'],
    status: (result.status ?? 'active') as CaseSummary['status'],
    urgency: (result.urgency ?? 'standard') as CaseSummary['urgency'],
    reportedAt: String(result.reportedAt ?? ''),
    lastSeenAt: result.lastSeenAt ? String(result.lastSeenAt) : undefined,
    lastSeenLocation: result.lastSeenLocation ? String(result.lastSeenLocation) : undefined,
    lastSeenCountry: result.lastSeenCountry ? String(result.lastSeenCountry) : undefined,
    source: (result.source ?? 'other') as CaseSummary['source'],
    dataQuality: (result.dataQuality as number) ?? 0,
    persons: persons.map((p) => ({
      id: p.id as string,
      role: (p.role ?? 'missing_child') as CaseSummary['persons'][number]['role'],
      firstName: p.firstName ? String(p.firstName) : undefined,
      lastName: p.lastName ? String(p.lastName) : undefined,
      nickname: p.nickname ? String(p.nickname) : undefined,
      approximateAge: p.approximateAge != null ? Number(p.approximateAge) : undefined,
      dateOfBirth: p.dateOfBirth ? String(p.dateOfBirth) : undefined,
      gender: (p.gender ?? undefined) as CaseSummary['persons'][number]['gender'],
      primaryImageUrl: (p.thumbnailUrl ?? p.storageUrl ?? p.primaryImageUrl ?? undefined) as string | undefined,
    })),
    createdAt: String(result.createdAt ?? result.reportedAt ?? ''),
    updatedAt: String(result.updatedAt ?? result.reportedAt ?? ''),
  }
}

export function SearchPageClient({ initialQuery, initialPage }: SearchPageClientProps) {
  const [query, setQuery] = useState(initialQuery)
  const [filters, setFilters] = useState<CaseSearchFilters>({})
  const [isLoading, setIsLoading] = useState(false)
  const [cases, setCases] = useState<CaseSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(initialPage)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()
  const pathname = usePathname()
  const abortControllerRef = useRef<AbortController | null>(null)

  const LIMIT = 10
  const totalPages = Math.ceil(total / LIMIT)

  // Build query string for the /api/v1/search endpoint
  const runSearch = useCallback(async (q: string, f: CaseSearchFilters, p: number) => {
    // Abort previous request if still in-flight
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      params.set('page', String(p))
      params.set('limit', String(LIMIT))

      // Map filters to API query params
      if (f.source) params.set('source', f.source)
      if (f.status) params.set('status', f.status)
      if (f.gender) params.set('gender', f.gender)
      if (f.ageMin != null) params.set('ageMin', String(f.ageMin))
      if (f.ageMax != null) params.set('ageMax', String(f.ageMax))
      if (f.country) params.set('country', f.country)
      if (f.caseType) params.set('caseType', f.caseType)
      if (f.urgency) params.set('urgency', f.urgency)

      const response = await fetch(`/api/v1/search?${params.toString()}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`Erro ao buscar: ${response.status}`)
      }

      const json = await response.json() as {
        success: boolean
        data?: {
          results: Array<Record<string, unknown>>
          total: number
          page: number
          totalPages: number
        }
        error?: { message: string }
      }

      if (!json.success || !json.data) {
        throw new Error(json.error?.message ?? 'Erro desconhecido na busca')
      }

      const mapped = json.data.results.map(mapApiResultToCaseSummary)
      setCases(mapped)
      setTotal(json.data.total)
    } catch (err) {
      // Ignore abort errors (user navigated / new search started)
      if (err instanceof Error && err.name === 'AbortError') return

      const message = err instanceof Error ? err.message : 'Erro ao buscar casos'
      setError(message)
      setCases([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    runSearch(query, filters, page)
  }, [query, filters, page, runSearch])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

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
            : error
            ? error
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
