'use client'

// =============================================================
// ShareButtons — Social share for case detail page
// WhatsApp primary, others secondary. Web Share API fallback.
// Sprint 4, E5
// =============================================================

import { useState } from 'react'

interface ShareButtonsProps {
  caseId: string
  caseName: string
  caseNumber: string
}

export function ShareButtons({ caseId, caseName, caseNumber }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  const caseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/case/${caseId}`
    : `/case/${caseId}`

  const shareText = `⚠️ CRIANÇA DESAPARECIDA — ${caseName} (Caso ${caseNumber})\nSe você viu esta criança, por favor reporte. ${caseUrl}`

  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer')
  }

  function handleX() {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer')
  }

  function handleFacebook() {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(caseUrl)}`, '_blank', 'noopener,noreferrer')
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(caseUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea')
      el.value = caseUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Criança desaparecida: ${caseName}`,
          text: shareText,
          url: caseUrl,
        })
      } catch {
        // User cancelled or not supported
      }
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="text-sm font-medium mr-1"
        style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
      >
        Compartilhar:
      </span>

      {/* WhatsApp — primary */}
      <button
        onClick={handleWhatsApp}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all"
        style={{
          backgroundColor: '#25D366',
          color: 'white',
          fontFamily: 'var(--font-heading)',
        }}
        aria-label="Compartilhar no WhatsApp"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
        WhatsApp
      </button>

      {/* X / Twitter */}
      <button
        onClick={handleX}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all"
        style={{
          backgroundColor: '#000000',
          color: 'white',
          fontFamily: 'var(--font-heading)',
        }}
        aria-label="Compartilhar no X (Twitter)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        X
      </button>

      {/* Facebook */}
      <button
        onClick={handleFacebook}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all"
        style={{
          backgroundColor: '#1877F2',
          color: 'white',
          fontFamily: 'var(--font-heading)',
        }}
        aria-label="Compartilhar no Facebook"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
        Facebook
      </button>

      {/* Copy link */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all"
        style={{
          border: '1.5px solid var(--color-border)',
          backgroundColor: 'var(--color-bg-primary)',
          color: copied ? 'var(--color-found-green)' : 'var(--color-text-secondary)',
          fontFamily: 'var(--font-heading)',
        }}
        aria-label="Copiar link"
      >
        {copied ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Copiado!
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Copiar link
          </>
        )}
      </button>

      {/* Native share (mobile) */}
      {typeof navigator !== 'undefined' && 'share' in navigator && (
        <button
          onClick={handleNativeShare}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all md:hidden"
          style={{
            border: '1.5px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-heading)',
          }}
          aria-label="Compartilhar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="16 6 12 2 8 6" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="2" x2="12" y2="15" strokeLinecap="round" />
          </svg>
          Compartilhar
        </button>
      )}
    </div>
  )
}
