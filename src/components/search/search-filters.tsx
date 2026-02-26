'use client'

// =============================================================
// SearchFilters — Sidebar filters for search results
// Desktop: 240px sticky sidebar. Mobile: bottom sheet.
// Sprint 4, E5
// =============================================================

import type { CaseSearchFilters, CaseSource } from '@/types/cases'

interface SearchFiltersProps {
  filters: CaseSearchFilters
  onChange: (filters: Partial<CaseSearchFilters>) => void
  onClear: () => void
  resultCount?: number
}

const SOURCES: { value: CaseSource; label: string; color: string }[] = [
  { value: 'fbi', label: 'FBI', color: '#3B82F6' },
  { value: 'interpol', label: 'Interpol', color: '#0EA5E9' },
  { value: 'ncmec', label: 'NCMEC', color: '#7C3AED' },
  { value: 'amber', label: 'AMBER Alert', color: '#F59E0B' },
  { value: 'platform', label: 'Plataforma', color: '#2D3561' },
  { value: 'disque100', label: 'Disque 100', color: '#10B981' },
]

const STATUSES = [
  { value: 'active', label: 'Ativo' },
  { value: 'resolved', label: 'Encontrado' },
  { value: 'archived', label: 'Arquivado' },
] as const

export function SearchFilters({ filters, onChange, onClear }: SearchFiltersProps) {
  return (
    <aside
      className="w-full"
      style={{ fontFamily: 'var(--font-body)' }}
      aria-label="Filtros de busca"
    >
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-sm font-semibold"
          style={{ color: 'var(--color-deep-indigo)', fontFamily: 'var(--font-heading)' }}
        >
          Filtros
        </span>
        <button
          onClick={onClear}
          className="text-xs transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Limpar
        </button>
      </div>

      {/* Source filter */}
      <fieldset className="mb-5">
        <legend
          className="text-xs font-semibold uppercase tracking-wide mb-3"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Fonte
        </legend>
        <div className="space-y-2">
          {SOURCES.map((src) => {
            const checked = !filters.source || filters.source === src.value
            return (
              <label key={src.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    onChange({ source: e.target.checked ? undefined : src.value })
                  }
                  className="w-4 h-4 rounded"
                  style={{ accentColor: src.color }}
                />
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: src.color }}
                />
                <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                  {src.label}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {/* Age range */}
      <fieldset className="mb-5">
        <legend
          className="text-xs font-semibold uppercase tracking-wide mb-3"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Idade
        </legend>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={filters.ageMax ?? 18}
            value={filters.ageMin ?? ''}
            onChange={(e) => onChange({ ageMin: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="Min"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
            }}
            aria-label="Idade mínima"
          />
          <span style={{ color: 'var(--color-text-muted)' }}>–</span>
          <input
            type="number"
            min={filters.ageMin ?? 0}
            max={18}
            value={filters.ageMax ?? ''}
            onChange={(e) => onChange({ ageMax: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="Max"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
            }}
            aria-label="Idade máxima"
          />
        </div>
      </fieldset>

      {/* Gender */}
      <fieldset className="mb-5">
        <legend
          className="text-xs font-semibold uppercase tracking-wide mb-3"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Gênero
        </legend>
        <div className="space-y-2">
          {(['female', 'male', 'other'] as const).map((g) => {
            const labels = { female: 'Feminino', male: 'Masculino', other: 'Outro' }
            return (
              <label key={g} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  checked={filters.gender === g}
                  onChange={() => onChange({ gender: g })}
                  className="w-4 h-4"
                  style={{ accentColor: 'var(--color-coral-hope)' }}
                />
                <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                  {labels[g]}
                </span>
              </label>
            )
          })}
          {filters.gender && (
            <button
              onClick={() => onChange({ gender: undefined })}
              className="text-xs mt-1 transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Limpar gênero
            </button>
          )}
        </div>
      </fieldset>

      {/* Status */}
      <fieldset className="mb-5">
        <legend
          className="text-xs font-semibold uppercase tracking-wide mb-3"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Status
        </legend>
        <div className="space-y-2">
          {STATUSES.map((s) => (
            <label key={s.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!filters.status || filters.status === s.value}
                onChange={(e) =>
                  onChange({ status: e.target.checked ? undefined : s.value })
                }
                className="w-4 h-4 rounded"
                style={{ accentColor: 'var(--color-coral-hope)' }}
              />
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {s.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Date range */}
      <fieldset className="mb-5">
        <legend
          className="text-xs font-semibold uppercase tracking-wide mb-3"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Período
        </legend>
        <div className="space-y-2">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
              Desde
            </label>
            <input
              type="date"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
              }}
              aria-label="Data de início do período"
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
              Até
            </label>
            <input
              type="date"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
              }}
              aria-label="Data de fim do período"
            />
          </div>
        </div>
      </fieldset>
    </aside>
  )
}
