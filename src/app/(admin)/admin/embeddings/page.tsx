'use client'

// =============================================================
// Admin Embeddings Generator — /admin/embeddings
// Lists cases with photos but no face embedding.
// Allows bulk generation of 128-dim descriptors via face-api.js
// running in the browser. Saves descriptors to DB via API.
//
// CORS workaround: external images proxied through /api/v1/proxy-image
// =============================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

// ---- Types --------------------------------------------------

interface CaseForEmbedding {
  imageId: string
  personId: string
  caseId: string
  caseNumber: string
  firstName: string | null
  lastName: string | null
  photoUrl: string
  hasEmbedding: boolean
}

interface EmbeddingStats {
  total: number
  searchable: number
}

type ItemStatus = 'pending' | 'processing' | 'success' | 'no-face' | 'error'

interface ProcessedItem {
  imageId: string
  status: ItemStatus
  error?: string
}

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/'

// ---- Component ----------------------------------------------

export default function AdminEmbeddingsPage() {
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelStatus, setModelStatus] = useState('')

  const [cases, setCases] = useState<CaseForEmbedding[]>([])
  const [stats, setStats] = useState<EmbeddingStats | null>(null)
  const [casesLoading, setCasesLoading] = useState(false)

  const [processing, setProcessing] = useState(false)
  const [processed, setProcessed] = useState<Map<string, ItemStatus>>(new Map())
  const [log, setLog] = useState<string[]>([])

  const abortRef = useRef(false)

  function appendLog(msg: string) {
    setLog((prev) => [
      `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`,
      ...prev.slice(0, 99),
    ])
  }

  // ---- Fetch cases needing embeddings ------------------------
  const fetchCases = useCallback(async () => {
    setCasesLoading(true)
    try {
      const res = await fetch('/api/v1/admin/cases-with-images', {
        credentials: 'include',
      })
      const data = await res.json()

      if (!data.success) {
        appendLog(`Erro ao carregar casos: ${data.error?.message}`)
        return
      }

      const items: CaseForEmbedding[] = (data.data ?? []).filter(
        (item: CaseForEmbedding) => !!item.photoUrl
      )

      setCases(items)
      appendLog(`${items.length} imagens carregadas (${items.filter((i) => i.hasEmbedding).length} com embedding)`)
    } catch (err) {
      appendLog(`Exceção: ${String(err)}`)
    } finally {
      setCasesLoading(false)
    }
  }, [])

  // ---- Fetch embedding stats ---------------------------------
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/face-embeddings')
      const data = await res.json()
      if (data.success) setStats(data.data)
    } catch {
      // Non-critical
    }
  }, [])

  useEffect(() => {
    fetchCases()
    fetchStats()
  }, [fetchCases, fetchStats])

  // ---- Load face-api.js models --------------------------------
  const loadModels = useCallback(async () => {
    if (modelsLoaded) return true
    setModelsLoading(true)
    setModelStatus('Carregando modelos...')
    try {
      const faceapi = await import('@vladmandic/face-api')
      setModelStatus('Detector SSD...')
      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)
      setModelStatus('Landmarks 68...')
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
      setModelStatus('Rede de reconhecimento...')
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      setModelsLoaded(true)
      setModelStatus('Modelos prontos')
      appendLog('Modelos face-api.js carregados com sucesso')
      return true
    } catch (err) {
      setModelStatus(`Falha: ${String(err)}`)
      appendLog(`Erro ao carregar modelos: ${String(err)}`)
      return false
    } finally {
      setModelsLoading(false)
    }
  }, [modelsLoaded])

  // ---- Process single image ----------------------------------
  const processImage = useCallback(
    async (item: CaseForEmbedding): Promise<ItemStatus> => {
      const faceapi = await import('@vladmandic/face-api')

      // Proxy URL to bypass CORS
      const proxiedUrl = `/api/v1/proxy-image?url=${encodeURIComponent(item.photoUrl)}`

      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = proxiedUrl

      try {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Image load failed'))
          // 10s timeout
          setTimeout(() => reject(new Error('Image load timeout')), 10_000)
        })
      } catch {
        return 'error'
      }

      const detection = await faceapi
        .detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (!detection) return 'no-face'

      const descriptor = Array.from(detection.descriptor)
      const bbox = detection.detection.box

      // Save to API
      const res = await fetch('/api/v1/face-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          imageId: item.imageId,
          personId: item.personId,
          descriptor,
          faceBbox: {
            x: bbox.x,
            y: bbox.y,
            width: bbox.width,
            height: bbox.height,
          },
          faceConfidence: detection.detection.score,
        }),
      })

      if (!res.ok) return 'error'
      return 'success'
    },
    []
  )

  // ---- Generate all embeddings --------------------------------
  const generateAll = useCallback(async () => {
    if (processing) return
    abortRef.current = false

    const loaded = await loadModels()
    if (!loaded) return

    setProcessing(true)
    const newProcessed = new Map<string, ItemStatus>()

    let successCount = 0
    let noFaceCount = 0
    let errorCount = 0

    const pending = cases.filter((c) => {
      const status = processed.get(c.imageId)
      if (status === 'success') return false
      if (c.hasEmbedding && !status) return false // skip already embedded
      return !status || status === 'error'
    })

    appendLog(`Iniciando geração de ${pending.length} embeddings...`)

    for (let i = 0; i < pending.length; i++) {
      if (abortRef.current) {
        appendLog('Geração interrompida pelo usuário.')
        break
      }

      const item = pending[i]
      setProcessed((prev) => new Map(prev).set(item.imageId, 'processing'))

      const status = await processImage(item)
      newProcessed.set(item.imageId, status)
      setProcessed((prev) => new Map(prev).set(item.imageId, status))

      if (status === 'success') successCount++
      else if (status === 'no-face') noFaceCount++
      else errorCount++

      if ((i + 1) % 5 === 0 || i === pending.length - 1) {
        appendLog(
          `Progresso: ${i + 1}/${pending.length} — OK: ${successCount}, sem rosto: ${noFaceCount}, erro: ${errorCount}`
        )
      }

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 200))
    }

    appendLog(
      `Concluído: ${successCount} embeddings salvos, ${noFaceCount} sem rosto, ${errorCount} erros`
    )
    setProcessing(false)
    fetchStats()
  }, [cases, loadModels, processImage, processed, processing, fetchStats])

  // ---- Generate single image ----------------------------------
  const generateSingle = useCallback(
    async (item: CaseForEmbedding) => {
      const loaded = await loadModels()
      if (!loaded) return

      setProcessed((prev) => new Map(prev).set(item.imageId, 'processing'))
      appendLog(`Processando: ${item.caseNumber}`)

      const status = await processImage(item)
      setProcessed((prev) => new Map(prev).set(item.imageId, status))
      appendLog(`${item.caseNumber}: ${status}`)

      if (status === 'success') fetchStats()
    },
    [loadModels, processImage, fetchStats]
  )

  // ---- Styles -------------------------------------------------
  const card: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.75rem',
    padding: '1.25rem',
  }

  const statusColors: Record<ItemStatus, { bg: string; color: string; label: string }> = {
    pending: { bg: '#F3F4F6', color: '#6B7280', label: 'Pendente' },
    processing: { bg: '#FEF3C7', color: '#92400E', label: 'Processando...' },
    success: { bg: '#D1FAE5', color: '#065F46', label: 'OK' },
    'no-face': { bg: '#F3F4F6', color: '#6B7280', label: 'Sem rosto' },
    error: { bg: '#FEE2E2', color: '#991B1B', label: 'Erro' },
  }

  const pendingCount = cases.filter((c) => {
    const status = processed.get(c.imageId)
    if (status === 'success') return false
    if (c.hasEmbedding && !status) return false // already has embedding
    return !status || status === 'error'
  }).length

  return (
    <main
      id="main-content"
      className="min-h-screen p-6"
      style={{ backgroundColor: 'var(--color-bg-secondary)' }}
    >
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <p
              className="text-xs uppercase tracking-widest mb-1"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
            >
              Admin / Embeddings
            </p>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
            >
              Gerador de Embeddings Faciais
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Processa fotos de casos e gera descritores face-api.js (128-dim) para busca facial.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link
              href="/admin/ingest"
              className="text-sm font-medium"
              style={{ color: 'var(--color-coral-hope)' }}
            >
              ← Ingest
            </Link>
            <Link
              href="/"
              className="text-sm font-medium"
              style={{ color: 'var(--color-coral-hope)' }}
            >
              ← Início
            </Link>
          </div>
        </div>

        {/* Stats card */}
        <div style={card} className="mb-4">
          <h2
            className="text-base font-semibold mb-3"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
          >
            Estado Atual
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Imagens carregadas', value: cases.length, mono: true },
              { label: 'Pendentes', value: pendingCount, mono: true },
              { label: 'Embeddings salvos', value: stats?.searchable ?? '—', mono: true },
              {
                label: 'Modelos',
                value: modelsLoaded ? 'Prontos' : modelsLoading ? modelStatus : 'Não carregados',
                mono: false,
              },
            ].map(({ label, value, mono }) => (
              <div
                key={label}
                className="text-center p-3 rounded-lg"
                style={{ backgroundColor: 'var(--color-bg-secondary)' }}
              >
                <p
                  className="text-2xl font-bold"
                  style={{
                    fontFamily: mono ? 'var(--font-mono)' : 'var(--font-heading)',
                    color: 'var(--color-deep-indigo)',
                  }}
                >
                  {value}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={card} className="mb-4">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => loadModels()}
              disabled={modelsLoaded || modelsLoading}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-deep-indigo)', fontFamily: 'var(--font-heading)' }}
            >
              {modelsLoaded ? 'Modelos prontos' : modelsLoading ? modelStatus : 'Carregar Modelos'}
            </button>
            <button
              onClick={generateAll}
              disabled={processing || cases.length === 0 || pendingCount === 0}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-coral-hope)', fontFamily: 'var(--font-heading)' }}
            >
              {processing ? 'Gerando...' : `Gerar Todos (${pendingCount})`}
            </button>
            {processing && (
              <button
                onClick={() => { abortRef.current = true }}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  backgroundColor: 'transparent',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                Parar
              </button>
            )}
            <button
              onClick={() => { fetchCases(); fetchStats() }}
              disabled={casesLoading}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              style={{
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                backgroundColor: 'transparent',
                fontFamily: 'var(--font-heading)',
              }}
            >
              Recarregar
            </button>
          </div>
        </div>

        {/* Cases list */}
        {cases.length > 0 && (
          <div style={card} className="mb-4">
            <h2
              className="text-base font-semibold mb-3"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
            >
              Imagens ({cases.length})
            </h2>
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {cases.map((item) => {
                const rawStatus = processed.get(item.imageId)
                const status: ItemStatus = rawStatus ?? (item.hasEmbedding ? 'success' : 'pending')
                const s = statusColors[status]
                return (
                  <div
                    key={item.imageId}
                    className="flex items-center gap-3 p-2.5 rounded-lg"
                    style={{
                      backgroundColor: 'var(--color-bg-secondary)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    {/* Thumbnail */}
                    <div
                      style={{
                        width: '40px',
                        height: '44px',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        flexShrink: 0,
                        backgroundColor: 'var(--color-bg-tertiary)',
                      }}
                    >
                      <img
                        src={`/api/v1/proxy-image?url=${encodeURIComponent(item.photoUrl)}`}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          const t = e.target as HTMLImageElement
                          t.style.display = 'none'
                        }}
                      />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        className="text-sm font-medium truncate"
                        style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
                      >
                        {[item.firstName, item.lastName].filter(Boolean).join(' ') || 'N/A'}
                      </p>
                      <p
                        className="text-xs truncate"
                        style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
                      >
                        {item.caseNumber}
                      </p>
                    </div>

                    {/* Status badge */}
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: s.bg, color: s.color, whiteSpace: 'nowrap' }}
                    >
                      {status === 'processing' && (
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full mr-1"
                          style={{ backgroundColor: s.color, animation: 'pulse 1s infinite' }}
                        />
                      )}
                      {s.label}
                    </span>

                    {/* Individual generate button */}
                    {(status === 'pending' || status === 'error' || status === 'no-face') && (
                      <button
                        onClick={() => generateSingle(item)}
                        disabled={processing}
                        className="text-xs font-medium px-2 py-1 rounded transition-all disabled:opacity-40"
                        style={{
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-secondary)',
                          backgroundColor: 'transparent',
                          cursor: processing ? 'not-allowed' : 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Gerar
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {casesLoading && (
          <div style={card} className="mb-4 text-center py-8">
            <p style={{ color: 'var(--color-text-secondary)' }}>Carregando casos...</p>
          </div>
        )}

        {/* Activity log */}
        {log.length > 0 && (
          <div style={card}>
            <h2
              className="text-sm font-semibold mb-2"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
            >
              Log de Atividade
            </h2>
            <div
              className="rounded-lg p-3 text-xs space-y-1 max-h-48 overflow-y-auto"
              style={{
                backgroundColor: 'var(--color-deep-indigo)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {log.map((entry, i) => (
                <div key={i} style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {entry}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </main>
  )
}
