'use client'

// =============================================================
// Admin Embeddings — /admin/embeddings
// DEPRECATED (F-01): Browser-side face-api.js (128-dim) removed.
// Face embeddings are now generated server-side via ArcFace (512-dim)
// through the Python face service. See ADR-001.
//
// This page now shows:
// 1. Deprecation notice explaining the migration
// 2. Current embedding stats from the DB
// 3. Cases with images for reference
// 4. Link to trigger server-side batch embedding (future F-02)
// =============================================================

import { useState, useEffect, useCallback } from 'react'
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

// ---- Component ----------------------------------------------

export default function AdminEmbeddingsPage() {
  const [cases, setCases] = useState<CaseForEmbedding[]>([])
  const [stats, setStats] = useState<EmbeddingStats | null>(null)
  const [casesLoading, setCasesLoading] = useState(false)

  // ---- Fetch cases needing embeddings ------------------------
  const fetchCases = useCallback(async () => {
    setCasesLoading(true)
    try {
      const res = await fetch('/api/v1/admin/cases-with-images', {
        credentials: 'include',
      })
      const data = await res.json()

      if (!data.success) {
        return
      }

      const items: CaseForEmbedding[] = (data.data ?? []).filter(
        (item: CaseForEmbedding) => !!item.photoUrl
      )

      setCases(items)
    } catch {
      // Non-critical
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

  // ---- Styles -------------------------------------------------
  const card: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.75rem',
    padding: '1.25rem',
  }

  const withEmbedding = cases.filter((c) => c.hasEmbedding).length
  const withoutEmbedding = cases.filter((c) => !c.hasEmbedding).length

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
              Face Embeddings
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Painel de status dos embeddings faciais do sistema.
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

        {/* Architecture Migration Notice */}
        <div
          className="mb-4 rounded-xl p-5"
          style={{
            backgroundColor: '#FEF3C7',
            border: '1px solid #F59E0B',
          }}
        >
          <h2 className="text-base font-semibold mb-2" style={{ color: '#92400E' }}>
            Arquitetura Migrada — ArcFace 512-dim (Server-Side)
          </h2>
          <div className="text-sm space-y-2" style={{ color: '#78350F' }}>
            <p>
              O sistema de busca facial foi migrado do modelo browser-side (face-api.js, 128-dim,
              brute-force) para o modelo server-side (ArcFace via Python FastAPI, 512-dim, pgvector HNSW).
            </p>
            <p>
              <strong>O que mudou:</strong>
            </p>
            <ul className="list-disc ml-5 space-y-1">
              <li>Geração de embeddings agora é feita pelo Python face service (porta 8000)</li>
              <li>Busca usa pgvector HNSW para ANN (approximate nearest neighbor)</li>
              <li>Precisão significativamente maior (512-dim vs 128-dim)</li>
              <li>HITL (human-in-the-loop) integrado para validação de matches</li>
            </ul>
            <p className="mt-2">
              <strong>Referência:</strong>{' '}
              <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: '#FDE68A' }}>
                ADR-001: Face Search Architecture
              </code>
            </p>
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
              { label: 'Imagens no sistema', value: cases.length },
              { label: 'Com embedding', value: withEmbedding },
              { label: 'Sem embedding', value: withoutEmbedding },
              { label: 'Embeddings buscáveis', value: stats?.searchable ?? '—' },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="text-center p-3 rounded-lg"
                style={{ backgroundColor: 'var(--color-bg-secondary)' }}
              >
                <p
                  className="text-2xl font-bold"
                  style={{
                    fontFamily: 'var(--font-mono)',
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

        {/* Server-side embedding info */}
        <div style={card} className="mb-4">
          <h2
            className="text-base font-semibold mb-3"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
          >
            Geração de Embeddings (Server-Side)
          </h2>
          <div className="text-sm space-y-2" style={{ color: 'var(--color-text-secondary)' }}>
            <p>
              Novos embeddings são gerados automaticamente durante a ingestão de dados, quando fotos
              são processadas pelo pipeline. O Python face service detecta rostos, gera embeddings
              ArcFace 512-dim, e armazena no pgvector.
            </p>
            <p>
              Para reprocessar imagens sem embedding, use o endpoint de batch embedding:
            </p>
            <div
              className="rounded-lg p-3 mt-2"
              style={{
                backgroundColor: 'var(--color-deep-indigo)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <code className="text-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>
                POST /api/v1/face/batch-embed
              </code>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                (Sprint 5 — F-02: Batch embedding via Python face service)
              </p>
            </div>
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
                const hasEmb = item.hasEmbedding
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
                      style={{
                        backgroundColor: hasEmb ? '#D1FAE5' : '#F3F4F6',
                        color: hasEmb ? '#065F46' : '#6B7280',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {hasEmb ? 'Embedding OK' : 'Pendente'}
                    </span>
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

        {/* Actions */}
        <div style={card}>
          <div className="flex flex-wrap gap-3">
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
            <Link
              href="/face-search"
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all text-white"
              style={{
                backgroundColor: 'var(--color-coral-hope)',
                fontFamily: 'var(--font-heading)',
              }}
            >
              Ir para Busca Facial
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
