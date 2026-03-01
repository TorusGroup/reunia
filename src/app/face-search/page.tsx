'use client'

// =============================================================
// Face Search Page — /face-search
// Sprint 4 (FS-03): Complete face search E2E UI
//
// Architecture: Server-side face matching via /api/v1/face/match
// - Python ArcFace (512-dim) when available
// - JS-native fallback when Python service is down
// - All matches go through HITL queue (NON-NEGOTIABLE)
//
// Features:
// - Drag & drop or click to upload
// - Image preview with processing overlay
// - Result grid with confidence badges
// - Error states with helpful guidance
// - WCAG AA accessible
// =============================================================

import { useRef, useState, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

// ---- Types --------------------------------------------------

interface FaceSearchMatch {
  face_embedding_id: string
  person_id: string
  case_id: string
  similarity: number
  confidence_tier: 'HIGH' | 'MEDIUM' | 'LOW' | 'REJECTED'
  person_name: string | null
  case_number: string
  primary_photo_url: string | null
}

interface FaceMatchResponse {
  face_detected: boolean
  face_confidence: number | null
  face_quality: number | null
  match_count: number
  matches: FaceSearchMatch[]
  hitl_queued: number
  processing_ms: number
  notice: string
}

type PageState =
  | 'idle'
  | 'uploading'
  | 'searching'
  | 'done'
  | 'error'

// ---- Helpers ------------------------------------------------

function confidenceLabel(tier: string): {
  label: string
  color: string
  bg: string
} {
  switch (tier) {
    case 'HIGH':
      return { label: 'Alta', color: '#065F46', bg: '#D1FAE5' }
    case 'MEDIUM':
      return { label: 'Media', color: '#92400E', bg: '#FEF3C7' }
    case 'LOW':
      return { label: 'Baixa', color: '#1D4ED8', bg: '#DBEAFE' }
    default:
      return { label: 'Muito Baixa', color: '#6B7280', bg: '#F3F4F6' }
  }
}

function similarityPercent(similarity: number): string {
  return `${Math.round(similarity * 100)}%`
}

/**
 * Convert a File to base64 string (without the data:... prefix)
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remove the data:image/xxx;base64, prefix
      const base64 = result.split(',')[1]
      if (base64) {
        resolve(base64)
      } else {
        reject(new Error('Failed to convert file to base64'))
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// ---- Component ----------------------------------------------

export default function FaceSearchPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const [pageState, setPageState] = useState<PageState>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [results, setResults] = useState<FaceMatchResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // ---- Process image (shared by file input and drag-drop) ----
  const processImage = useCallback(async (file: File) => {
    // Reset state
    setResults(null)
    setErrorMessage(null)

    // Validate type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMessage('Formato nao suportado. Use JPG, PNG ou WEBP.')
      setPageState('error')
      return
    }

    // Validate size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Arquivo muito grande. Maximo 10MB.')
      setPageState('error')
      return
    }

    // Show preview
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)

    // Convert to base64 and send to server
    setPageState('uploading')
    setStatusMessage('Preparando imagem...')

    try {
      const base64 = await fileToBase64(file)

      setPageState('searching')
      setStatusMessage('Analisando rosto e buscando correspondencias...')

      const response = await fetch('/api/v1/face/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: base64,
          threshold: 0.55,
          max_results: 10,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        const msg = data.error?.message ?? 'Erro ao buscar correspondencias.'

        // Special handling for no face detected
        if (
          data.error?.code === 'VALIDATION_ERROR' &&
          msg.toLowerCase().includes('no face')
        ) {
          setErrorMessage(
            'Nenhum rosto detectado na imagem. Use uma foto com o rosto claramente visivel, bem iluminado e de frente.'
          )
        } else if (data.error?.code === 'RATE_LIMIT_EXCEEDED') {
          setErrorMessage(
            'Muitas tentativas. Aguarde um minuto e tente novamente.'
          )
        } else if (data.error?.code === 'INTERNAL_ERROR' || msg.toLowerCase().includes('pipeline failed')) {
          setErrorMessage(
            'O servico de reconhecimento facial esta temporariamente indisponivel. '
            + 'Use a busca por nome enquanto isso. Pedimos desculpas pelo inconveniente.'
          )
        } else if (data.error?.code === 'UNAUTHORIZED') {
          setErrorMessage(
            'Voce precisa estar logado para usar a busca facial. Faca login e tente novamente.'
          )
        } else {
          setErrorMessage(msg)
        }

        setPageState('error')
        return
      }

      setResults(data.data as FaceMatchResponse)
      setPageState('done')
      setStatusMessage('')
    } catch (err) {
      console.error('Face search error:', err)
      setErrorMessage(
        'Ocorreu um erro durante a busca. Por favor, tente novamente.'
      )
      setPageState('error')
    }
  }, [])

  // ---- Handle file selection ---------------------------------
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      await processImage(file)
      // Reset file input so same file can be reselected
      e.target.value = ''
    },
    [processImage]
  )

  // ---- Drag and Drop handlers --------------------------------
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const file = e.dataTransfer.files?.[0]
      if (file) {
        await processImage(file)
      }
    },
    [processImage]
  )

  const handleReset = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setResults(null)
    setErrorMessage(null)
    setPageState('idle')
    setStatusMessage('')
  }, [preview])

  const isProcessing =
    pageState === 'uploading' || pageState === 'searching'

  // ---- CSS-in-JS styles (using design tokens) ----------------
  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.5rem',
  }

  return (
    <>
      <Header />
      <main
        id="main-content"
        className="min-h-screen py-10 px-6"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        <div className="max-w-3xl mx-auto">

        {/* Page Header */}
        <div className="mb-8">
          <p
            className="text-xs uppercase tracking-widest mb-1"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
          >
            Busca por Reconhecimento Facial
          </p>
          <h1
            className="text-3xl font-bold mb-2"
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 300,
              color: 'var(--color-deep-indigo)',
            }}
          >
            Buscar por Foto
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Envie uma foto para buscar correspondencias em nosso banco de casos ativos.
            A analise facial e realizada por nossos servidores seguros — sua foto nao e armazenada.
          </p>
        </div>

        {/* Upload Card */}
        <div style={cardStyle} className="mb-6">

          {/* Upload zone or preview */}
          {!preview ? (
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full transition-all"
                style={{
                  padding: '2.5rem 1.5rem',
                  border: `2px dashed ${isDragOver ? 'var(--color-coral-hope)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: isDragOver
                    ? 'var(--color-coral-hope-light)'
                    : 'var(--color-bg-secondary)',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transform: isDragOver ? 'scale(1.01)' : 'scale(1)',
                  transition: 'all 0.2s ease',
                }}
                aria-label="Clique ou arraste uma foto para busca facial"
              >
                {/* Camera icon */}
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: isDragOver
                      ? 'var(--color-coral-hope)'
                      : 'var(--color-deep-indigo)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.2s ease',
                  }}
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <p
                    className="text-base font-semibold"
                    style={{
                      fontFamily: 'var(--font-heading)',
                      color: isDragOver
                        ? 'var(--color-coral-hope-dark)'
                        : 'var(--color-deep-indigo)',
                    }}
                  >
                    {isDragOver
                      ? 'Solte a foto aqui'
                      : 'Clique ou arraste uma foto'}
                  </p>
                  <p
                    className="text-sm mt-1"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    JPG, PNG ou WEBP — maximo 10MB
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Funciona melhor com fotos frontais, boa iluminacao
                  </p>
                </div>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                aria-hidden="true"
              />
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <img
                src={preview}
                alt="Foto selecionada para busca facial"
                style={{
                  width: '100%',
                  maxHeight: '320px',
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-md)',
                  display: 'block',
                }}
              />

              {/* Processing overlay */}
              {isProcessing && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(45, 53, 97, 0.82)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem',
                  }}
                  aria-live="polite"
                  aria-busy="true"
                >
                  {/* Radar spinner */}
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      border: '3px solid rgba(232, 99, 74, 0.25)',
                      borderTopColor: 'var(--color-coral-hope)',
                      animation: 'spin 0.9s linear infinite',
                    }}
                    role="status"
                    aria-label="Processando"
                  />
                  <p
                    style={{
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: 500,
                      textAlign: 'center',
                      maxWidth: '240px',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {statusMessage}
                  </p>
                </div>
              )}

              {/* Reset button (only when not processing) */}
              {!isProcessing && (
                <button
                  onClick={handleReset}
                  aria-label="Remover foto e tentar novamente"
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'var(--color-deep-indigo)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-elevated)',
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Status message (outside overlay, for non-processing states) */}
          {!isProcessing && statusMessage && (
            <p
              className="text-sm mt-3 text-center"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {statusMessage}
            </p>
          )}

          {/* Error message */}
          {errorMessage && (
            <div
              role="alert"
              className="mt-4 p-3 rounded-lg flex gap-3 text-sm"
              style={{
                backgroundColor: 'var(--color-alert-amber-light)',
                border: '1px solid var(--color-alert-amber)',
                color: '#92400E',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0, marginTop: '1px' }}
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {errorMessage}
            </div>
          )}

          {/* Try another photo button after error or done */}
          {(pageState === 'error' || pageState === 'done') && preview && (
            <button
              onClick={handleReset}
              className="mt-4 w-full py-2.5 text-sm font-semibold rounded-lg transition-all"
              style={{
                border: '2px solid var(--color-deep-indigo)',
                color: 'var(--color-deep-indigo)',
                backgroundColor: 'transparent',
                fontFamily: 'var(--font-heading)',
                cursor: 'pointer',
              }}
            >
              Buscar outra foto
            </button>
          )}
        </div>

        {/* Ethical disclaimer */}
        <div
          className="mb-6 p-4 rounded-lg text-sm"
          style={{
            backgroundColor: 'rgba(45, 53, 97, 0.05)',
            border: '1px solid rgba(45, 53, 97, 0.12)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: 'var(--color-deep-indigo)' }}>
            Aviso de privacidade:
          </strong>{' '}
          O reconhecimento facial e processado em servidores seguros.
          A foto enviada e analisada e imediatamente descartada — nenhuma imagem biometrica
          do cidadao e armazenada. Todos os resultados passam por revisao humana
          antes de qualquer acao.{' '}
          <strong style={{ color: 'var(--color-coral-hope)' }}>
            Em caso de emergencia: CVV 188 (24h, gratuito) | Disque 100
          </strong>
        </div>

        {/* Results */}
        {pageState === 'done' && results && (
          <div>
            {/* Summary bar */}
            <div
              className="mb-4 p-4 rounded-lg flex items-center justify-between flex-wrap gap-2"
              style={{
                backgroundColor:
                  results.match_count > 0
                    ? 'var(--color-data-blue-light)'
                    : 'var(--color-bg-tertiary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <div>
                <p
                  className="font-semibold"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    color:
                      results.match_count > 0
                        ? 'var(--color-data-blue-dark)'
                        : 'var(--color-text-secondary)',
                  }}
                >
                  {results.match_count > 0
                    ? `${results.match_count} correspondencia${results.match_count > 1 ? 's' : ''} encontrada${results.match_count > 1 ? 's' : ''}`
                    : 'Nenhuma correspondencia encontrada'}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Processado em {results.processing_ms}ms
                  {results.face_confidence !== null &&
                    ` | Confianca do rosto: ${Math.round(results.face_confidence * 100)}%`}
                </p>
              </div>
              {results.match_count === 0 && (
                <p
                  className="text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Nenhum caso ativo correspondeu ao rosto fornecido.
                </p>
              )}
            </div>

            {/* Match cards */}
            {results.matches.length > 0 && (
              <div className="space-y-3">
                <p
                  className="text-xs uppercase tracking-widest"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Resultados — revisao humana obrigatoria antes de qualquer acao
                </p>

                {results.matches.map((match, idx) => {
                  const conf = confidenceLabel(match.confidence_tier)
                  return (
                    <div
                      key={`${match.case_id}-${idx}`}
                      style={{
                        backgroundColor: 'var(--color-bg-primary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '1rem',
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'flex-start',
                      }}
                    >
                      {/* Photo */}
                      <div
                        style={{
                          width: '72px',
                          height: '80px',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          flexShrink: 0,
                          backgroundColor: 'var(--color-bg-tertiary)',
                        }}
                      >
                        {match.primary_photo_url ? (
                          <img
                            src={`/api/v1/proxy-image?url=${encodeURIComponent(match.primary_photo_url)}`}
                            alt={match.person_name ?? 'Caso'}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--color-text-muted)',
                            }}
                          >
                            <svg
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              aria-hidden="true"
                            >
                              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p
                              className="font-semibold"
                              style={{
                                fontFamily: 'var(--font-heading)',
                                color: 'var(--color-deep-indigo)',
                              }}
                            >
                              {match.person_name || 'Nome nao disponivel'}
                            </p>
                          </div>

                          {/* Confidence badge */}
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: conf.bg,
                              color: conf.color,
                              fontFamily: 'var(--font-mono)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {similarityPercent(match.similarity)} — {conf.label}
                          </span>
                        </div>

                        <div className="mt-2 space-y-1">
                          <p
                            className="text-xs"
                            style={{
                              color: 'var(--color-text-muted)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {match.case_number}
                          </p>
                        </div>

                        {/* View case link */}
                        <a
                          href={`/case/${match.case_id}`}
                          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold transition-colors"
                          style={{
                            color: 'var(--color-coral-hope)',
                            fontFamily: 'var(--font-heading)',
                            textDecoration: 'none',
                          }}
                        >
                          Ver caso completo
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  )
                })}

                {/* HITL notice */}
                <div
                  className="p-3 rounded-lg text-xs"
                  style={{
                    backgroundColor: 'rgba(45, 53, 97, 0.05)',
                    border: '1px solid rgba(45, 53, 97, 0.10)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {results.hitl_queued > 0 && (
                    <p className="mb-1">
                      <strong>{results.hitl_queued} resultado{results.hitl_queued > 1 ? 's' : ''}</strong>{' '}
                      enviado{results.hitl_queued > 1 ? 's' : ''} para revisao humana.
                    </p>
                  )}
                  Todos os resultados passam por revisao humana antes de qualquer notificacao.
                  O algoritmo indica possibilidades — a decisao final e sempre de um humano.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

        {/* Global spin animation */}
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </main>
      <Footer />
    </>
  )
}
