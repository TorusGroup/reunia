'use client'

// =============================================================
// Face Search Page — /face-search
// Client Component: uses face-api.js (browser-side) to detect
// face and generate 128-dim descriptor, then sends to server
// for cosine similarity comparison against stored embeddings.
//
// Architecture: Browser detects face → Server compares → Results
// No biometrics stored from citizen uploads.
// =============================================================

import { useRef, useState, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

// ---- Types --------------------------------------------------

interface FaceSearchMatch {
  similarity: number
  caseId: string
  caseNumber: string
  personId: string
  firstName: string | null
  lastName: string | null
  approximateAge: number | null
  lastSeenLocation: string | null
  photoUrl: string | null
  source: string
}

interface FaceSearchResult {
  matches: FaceSearchMatch[]
  totalCompared: number
  processingTimeMs: number
  notice: string
}

type PageState =
  | 'idle'
  | 'loading-models'
  | 'detecting'
  | 'searching'
  | 'done'
  | 'error'

const MODEL_URL =
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/'

// ---- Helpers ------------------------------------------------

function confidenceLabel(similarity: number): {
  label: string
  color: string
  bg: string
} {
  if (similarity >= 0.8)
    return { label: 'Alta', color: '#065F46', bg: '#D1FAE5' }
  if (similarity >= 0.65)
    return { label: 'Média', color: '#92400E', bg: '#FEF3C7' }
  return { label: 'Baixa', color: '#1D4ED8', bg: '#DBEAFE' }
}

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    fbi: 'FBI',
    interpol: 'Interpol',
    ncmec: 'NCMEC',
    amber: 'AMBER',
    platform: 'ReunIA',
    other: 'Outro',
  }
  return map[source] ?? source.toUpperCase()
}

// ---- Component ----------------------------------------------

export default function FaceSearchPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLImageElement>(null)

  const [pageState, setPageState] = useState<PageState>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [results, setResults] = useState<FaceSearchResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [modelsLoaded, setModelsLoaded] = useState(false)

  // ---- Load models (once) ------------------------------------
  const loadModels = useCallback(async () => {
    if (modelsLoaded) return true

    setPageState('loading-models')
    setStatusMessage('Carregando modelos de reconhecimento facial...')

    try {
      // Dynamic import — face-api.js only works in browser
      const faceapi = await import('@vladmandic/face-api')

      setStatusMessage('Carregando detector de rostos...')
      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)

      setStatusMessage('Carregando detector de landmarks...')
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)

      setStatusMessage('Carregando rede de reconhecimento...')
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)

      setModelsLoaded(true)
      return true
    } catch (err) {
      console.error('Failed to load face-api.js models:', err)
      setErrorMessage(
        'Falha ao carregar os modelos de reconhecimento facial. Verifique sua conexão e tente novamente.'
      )
      setPageState('error')
      return false
    }
  }, [modelsLoaded])

  // ---- Handle file selection ---------------------------------
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      // Reset state
      setResults(null)
      setErrorMessage(null)

      // Validate type
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setErrorMessage('Formato não suportado. Use JPG, PNG ou WEBP.')
        return
      }

      // Show preview
      const objectUrl = URL.createObjectURL(file)
      setPreview(objectUrl)

      // Load models if needed
      const loaded = await loadModels()
      if (!loaded) return

      // Detect face
      setPageState('detecting')
      setStatusMessage('Detectando rosto na imagem...')

      try {
        const faceapi = await import('@vladmandic/face-api')

        // Create HTMLImageElement from file
        const img = new Image()
        img.src = objectUrl

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Failed to load image'))
        })

        const detection = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor()

        if (!detection) {
          setErrorMessage(
            'Nenhum rosto detectado na imagem. Use uma foto com o rosto claramente visível, bem iluminado e de frente.'
          )
          setPageState('error')
          return
        }

        const descriptor = Array.from(detection.descriptor)

        // Search on server
        setPageState('searching')
        setStatusMessage(
          `Rosto detectado (confiança: ${Math.round(detection.detection.score * 100)}%). Buscando correspondências...`
        )

        const response = await fetch('/api/v1/face-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ descriptor, threshold: 0.4, maxResults: 10 }),
        })

        const data = await response.json()

        if (!data.success) {
          setErrorMessage(data.error?.message ?? 'Erro ao buscar correspondências.')
          setPageState('error')
          return
        }

        setResults(data.data as FaceSearchResult)
        setPageState('done')
        setStatusMessage('')
      } catch (err) {
        console.error('Face search error:', err)
        setErrorMessage(
          'Ocorreu um erro durante a busca. Por favor, tente novamente.'
        )
        setPageState('error')
      }

      // Reset file input so same file can be reselected
      e.target.value = ''
    },
    [loadModels]
  )

  const handleReset = useCallback(() => {
    setPreview(null)
    setResults(null)
    setErrorMessage(null)
    setPageState('idle')
    setStatusMessage('')
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const isProcessing =
    pageState === 'loading-models' ||
    pageState === 'detecting' ||
    pageState === 'searching'

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

        {/* ── Page Header ──────────────────────────────────────── */}
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
            Envie uma foto para buscar correspondências em nosso banco de casos ativos.
            O reconhecimento facial é feito no seu navegador — a foto não é armazenada.
          </p>
        </div>

        {/* ── Upload Card ──────────────────────────────────────── */}
        <div style={cardStyle} className="mb-6">

          {/* Upload zone or preview */}
          {!preview ? (
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full transition-all"
                style={{
                  padding: '2.5rem 1.5rem',
                  border: '2px dashed var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
                aria-label="Clique para enviar uma foto"
              >
                {/* Camera icon */}
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-deep-indigo)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
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
                      color: 'var(--color-deep-indigo)',
                    }}
                  >
                    Clique para selecionar uma foto
                  </p>
                  <p
                    className="text-sm mt-1"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    JPG, PNG ou WEBP — máximo 10MB
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Funciona melhor com fotos frontais, boa iluminação
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
                ref={previewRef}
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

        {/* ── Ethical disclaimer ────────────────────────────────── */}
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
          O reconhecimento facial é processado inteiramente no seu navegador usando face-api.js.
          Apenas um vetor matemático anônimo de 128 números é enviado ao servidor para comparação
          — nenhuma imagem biométrica é armazenada. Todos os resultados passam por revisão humana
          antes de qualquer ação.{' '}
          <strong style={{ color: 'var(--color-coral-hope)' }}>
            Em caso de emergência: CVV 188 (24h, gratuito) | Disque 100
          </strong>
        </div>

        {/* ── Results ──────────────────────────────────────────── */}
        {pageState === 'done' && results && (
          <div>
            {/* Summary bar */}
            <div
              className="mb-4 p-4 rounded-lg flex items-center justify-between flex-wrap gap-2"
              style={{
                backgroundColor:
                  results.matches.length > 0
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
                      results.matches.length > 0
                        ? 'var(--color-data-blue-dark)'
                        : 'var(--color-text-secondary)',
                  }}
                >
                  {results.matches.length > 0
                    ? `${results.matches.length} correspondência${results.matches.length > 1 ? 's' : ''} encontrada${results.matches.length > 1 ? 's' : ''}`
                    : 'Nenhuma correspondência encontrada'}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Comparado com {results.totalCompared} caso
                  {results.totalCompared !== 1 ? 's' : ''} em{' '}
                  {results.processingTimeMs}ms
                </p>
              </div>
              {results.matches.length === 0 && (
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
                  Resultados — revisão humana obrigatória antes de qualquer ação
                </p>

                {results.matches.map((match, idx) => {
                  const conf = confidenceLabel(match.similarity)
                  return (
                    <div
                      key={`${match.caseId}-${idx}`}
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
                        {match.photoUrl ? (
                          <img
                            src={`/api/v1/proxy-image?url=${encodeURIComponent(match.photoUrl)}`}
                            alt={`${match.firstName ?? ''} ${match.lastName ?? ''}`.trim() || 'Caso'}
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
                              {[match.firstName, match.lastName]
                                .filter(Boolean)
                                .join(' ') || 'Nome não disponível'}
                            </p>
                            {match.approximateAge !== null && (
                              <p
                                className="text-sm"
                                style={{ color: 'var(--color-text-secondary)' }}
                              >
                                ~{match.approximateAge} anos
                              </p>
                            )}
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
                            {Math.round(match.similarity * 100)}% — {conf.label}
                          </span>
                        </div>

                        <div className="mt-2 space-y-1">
                          {match.lastSeenLocation && (
                            <p
                              className="text-xs flex items-center gap-1"
                              style={{ color: 'var(--color-text-muted)' }}
                            >
                              <svg
                                width="11"
                                height="11"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden="true"
                              >
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                                <circle cx="12" cy="10" r="3" />
                              </svg>
                              {match.lastSeenLocation}
                            </p>
                          )}
                          <p
                            className="text-xs"
                            style={{
                              color: 'var(--color-text-muted)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {match.caseNumber} · {sourceLabel(match.source)}
                          </p>
                        </div>

                        {/* View case link */}
                        <a
                          href={`/case/${match.caseId}`}
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
                  Todos os resultados passam por revisão humana antes de qualquer notificação.
                  O algoritmo indica possibilidades — a decisão final é sempre de um humano.
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
