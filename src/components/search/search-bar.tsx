'use client'

// =============================================================
// SearchBar — Main search input with icon and submit
// Used on homepage (hero) and search page
// Sprint 4, E5
// =============================================================

import { useState, useRef, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

interface SearchBarProps {
  defaultValue?: string
  size?: 'hero' | 'compact'
  placeholder?: string
  onSearch?: (query: string) => void
  autoFocus?: boolean
  showClearButton?: boolean
}

export function SearchBar({
  defaultValue = '',
  size = 'hero',
  placeholder = 'Nome, idade ou número do caso...',
  onSearch,
  autoFocus = false,
  showClearButton = false,
}: SearchBarProps) {
  const [value, setValue] = useState(defaultValue)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const q = value.trim()
    if (onSearch) {
      onSearch(q)
    } else {
      router.push(`/search?q=${encodeURIComponent(q)}`)
    }
  }

  const inputHeight = size === 'hero' ? '56px' : '44px'
  const textSize = size === 'hero' ? 'text-base' : 'text-sm'

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Buscar criança desaparecida"
      className="w-full"
    >
      <div
        className="relative flex items-center rounded-lg transition-all duration-200"
        style={{
          border: '1.5px solid var(--color-border)',
          backgroundColor: 'var(--color-bg-primary)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* Search icon */}
        <div
          className="absolute left-4 pointer-events-none"
          aria-hidden="true"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" strokeLinecap="round" />
          </svg>
        </div>

        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`w-full pl-11 pr-4 rounded-lg bg-transparent border-none outline-none ${textSize}`}
          style={{
            height: inputHeight,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-body)',
          }}
          aria-label="Buscar por nome, idade ou número de caso"
          role="searchbox"
        />

        {/* Clear button */}
        {showClearButton && value && (
          <button
            type="button"
            onClick={() => {
              setValue('')
              inputRef.current?.focus()
            }}
            className="absolute right-14 flex items-center justify-center w-6 h-6"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Limpar busca"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {/* Submit button */}
        <button
          type="submit"
          className="absolute right-2 flex items-center justify-center rounded-md transition-colors"
          style={{
            width: '40px',
            height: '40px',
            backgroundColor: 'var(--color-coral-hope)',
            color: 'white',
          }}
          aria-label="Buscar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </form>
  )
}
