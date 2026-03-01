'use client'

// =============================================================
// CaseGallery — Photo carousel with lightbox
// Primary 3:4 portrait aspect, thumbnail strip
// Sprint 4, E5
// =============================================================

import { useState, useCallback } from 'react'
import type { ImageDetail } from '@/types/cases'

interface CaseGalleryProps {
  images: ImageDetail[]
  personName: string
}

export function CaseGallery({ images, personName }: CaseGalleryProps) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set())

  const handleImageError = useCallback((imageId: string) => {
    setBrokenImages((prev) => new Set(prev).add(imageId))
  }, [])

  // Filter out broken images
  const validImages = images.filter((img) => !brokenImages.has(img.id))
  const safeActiveIdx = Math.min(activeIdx, validImages.length - 1)
  const activeImage = validImages[safeActiveIdx]

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && safeActiveIdx > 0) setActiveIdx(safeActiveIdx - 1)
      if (e.key === 'ArrowRight' && safeActiveIdx < validImages.length - 1) setActiveIdx(safeActiveIdx + 1)
      if (e.key === 'Escape') setLightboxOpen(false)
    },
    [safeActiveIdx, validImages.length]
  )

  if (!validImages.length) {
    return (
      <div
        className="rounded-xl flex flex-col items-center justify-center gap-4 py-12"
        style={{
          backgroundColor: 'var(--color-bg-tertiary)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Silhouette */}
        <svg width="80" height="100" viewBox="0 0 80 100" fill="none" aria-hidden="true">
          <circle cx="40" cy="28" r="18" fill="#D1D5DB" />
          <path d="M6 88c0-18.778 15.222-34 34-34s34 15.222 34 34" stroke="#D1D5DB" strokeWidth="4" strokeLinecap="round" fill="none" />
        </svg>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Sem foto disponível
        </p>
        <a
          href="#contribute-photo"
          className="text-sm font-medium"
          style={{ color: 'var(--color-coral-hope)', fontFamily: 'var(--font-heading)' }}
        >
          Contribuir com foto
        </a>
      </div>
    )
  }

  return (
    <section aria-label={`Fotos do caso: ${personName}`} role="region">
      {/* Primary photo */}
      <div
        className="relative w-full rounded-xl overflow-hidden cursor-pointer"
        style={{ aspectRatio: '3/4', backgroundColor: 'var(--color-bg-tertiary)' }}
        onClick={() => setLightboxOpen(true)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`Ampliar foto ${safeActiveIdx + 1} de ${validImages.length}`}
      >
        {activeImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activeImage.storageUrl}
            alt={`${personName} — foto ${safeActiveIdx + 1}`}
            className="w-full h-full object-cover"
            style={{ objectPosition: 'top center' }}
            loading="eager"
            onError={() => handleImageError(activeImage.id)}
          />
        )}
        {/* Navigation arrows */}
        {validImages.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setActiveIdx(Math.max(0, safeActiveIdx - 1)) }}
              disabled={safeActiveIdx === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
              style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}
              aria-label="Foto anterior"
            >
              ←
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setActiveIdx(Math.min(validImages.length - 1, safeActiveIdx + 1)) }}
              disabled={safeActiveIdx === validImages.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
              style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}
              aria-label="Próxima foto"
            >
              →
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {validImages.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto" aria-label="Miniaturas de fotos">
          {validImages.map((img, idx) => (
            <button
              key={img.id}
              onClick={() => setActiveIdx(idx)}
              className="flex-shrink-0 rounded-lg overflow-hidden transition-all"
              style={{
                width: '56px',
                height: '72px',
                border: idx === safeActiveIdx
                  ? '2px solid var(--color-coral-hope)'
                  : '2px solid transparent',
                opacity: idx === safeActiveIdx ? 1 : 0.6,
                backgroundColor: 'var(--color-bg-tertiary)',
              }}
              aria-label={`Foto ${idx + 1}`}
              aria-pressed={idx === safeActiveIdx}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.thumbnailUrl ?? img.storageUrl}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                onError={() => handleImageError(img.id)}
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && activeImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
          onClick={() => setLightboxOpen(false)}
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-modal="true"
          aria-label="Visualizar foto em tela cheia"
          tabIndex={-1}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}
            aria-label="Fechar"
          >
            ✕
          </button>
          <div onClick={(e) => e.stopPropagation()} className="max-h-screen max-w-screen-sm p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImage.storageUrl}
              alt={`${personName} — foto ${safeActiveIdx + 1}`}
              className="max-h-[90vh] max-w-full object-contain rounded-xl"
            />
          </div>
          {validImages.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveIdx(Math.max(0, safeActiveIdx - 1)) }}
                disabled={safeActiveIdx === 0}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white disabled:opacity-30"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                aria-label="Foto anterior"
              >
                ←
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveIdx(Math.min(validImages.length - 1, safeActiveIdx + 1)) }}
                disabled={safeActiveIdx === validImages.length - 1}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white disabled:opacity-30"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                aria-label="Próxima foto"
              >
                →
              </button>
            </>
          )}
        </div>
      )}
    </section>
  )
}
