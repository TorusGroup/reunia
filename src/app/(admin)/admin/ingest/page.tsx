'use client'

// =============================================================
// Admin Ingest Page — /admin/ingest
// Manual ingestion trigger + seed + live results
// No auth required (test mode)
// =============================================================

import { useState } from 'react'
import Link from 'next/link'

interface IngestionResult {
  source: string
  recordsFetched: number
  recordsInserted: number
  recordsUpdated: number
  recordsSkipped: number
  recordsFailed: number
  durationMs: number
  errors: Array<{ error: string; externalId?: string }>
}

interface TriggerResponse {
  success: boolean
  data?: {
    source: string
    startedAt: string
    completedAt: string
    totalDurationMs: number
    summary: {
      totalFetched: number
      totalInserted: number
      totalUpdated: number
      totalSkipped: number
      totalFailed: number
    }
    results: IngestionResult[]
  }
  error?: { code: string; message: string }
}

interface SeedResponse {
  success: boolean
  data?: {
    message: string
    created: number
    existed: number
    sources: Array<{ slug: string; action: 'created' | 'exists' }>
  }
  error?: { code: string; message: string }
}

type Status = 'idle' | 'loading' | 'success' | 'error'

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, { bg: string; color: string; label: string }> = {
    idle: { bg: '#F3F4F6', color: '#6B7280', label: 'Pronto' },
    loading: { bg: '#FEF3C7', color: '#92400E', label: 'Executando...' },
    success: { bg: '#D1FAE5', color: '#065F46', label: 'Sucesso' },
    error: { bg: '#FEE2E2', color: '#991B1B', label: 'Erro' },
  }
  const s = styles[status]
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {status === 'loading' && (
        <span className="mr-1.5 inline-block w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: s.color }} />
      )}
      {s.label}
    </span>
  )
}

export default function AdminIngestPage() {
  const [status, setStatus] = useState<Status>('idle')
  const [seedStatus, setSeedStatus] = useState<Status>('idle')
  const [lastResult, setLastResult] = useState<TriggerResponse | null>(null)
  const [seedResult, setSeedResult] = useState<SeedResponse | null>(null)
  const [log, setLog] = useState<string[]>([])

  function appendLog(msg: string) {
    setLog((prev) => [`[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`, ...prev.slice(0, 49)])
  }

  async function runSeed() {
    setSeedStatus('loading')
    appendLog('Seeding DataSources...')
    try {
      const res = await fetch('/api/v1/ingestion/seed')
      const data: SeedResponse = await res.json()
      setSeedResult(data)
      if (data.success) {
        setSeedStatus('success')
        appendLog(`Seed OK: ${data.data?.message ?? 'done'}`)
      } else {
        setSeedStatus('error')
        appendLog(`Seed ERRO: ${data.error?.message ?? 'unknown'}`)
      }
    } catch (err) {
      setSeedStatus('error')
      appendLog(`Seed EXCEÇÃO: ${String(err)}`)
      setSeedResult(null)
    }
  }

  async function runIngestion(source: 'fbi' | 'interpol' | 'all') {
    setStatus('loading')
    // FBI: 5 pages x 50 records = ~250 records. Interpol: 1 page (may 403).
    const pages = source === 'interpol' ? 1 : 5
    appendLog(`Iniciando ingestion: source=${source}, maxPages=${pages}`)
    try {
      const res = await fetch('/api/v1/ingestion/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'reunia-admin',
        },
        body: JSON.stringify({ source, maxPages: pages }),
      })
      const data: TriggerResponse = await res.json()
      setLastResult(data)
      if (data.success) {
        setStatus('success')
        const s = data.data?.summary
        appendLog(
          `Ingestion OK [${source}]: fetched=${s?.totalFetched ?? 0}, inserted=${s?.totalInserted ?? 0}, updated=${s?.totalUpdated ?? 0}, failed=${s?.totalFailed ?? 0} (${data.data?.totalDurationMs ?? 0}ms)`
        )
      } else {
        setStatus('error')
        appendLog(`Ingestion ERRO [${source}]: ${data.error?.message ?? 'unknown'}`)
      }
    } catch (err) {
      setStatus('error')
      appendLog(`Ingestion EXCEÇÃO: ${String(err)}`)
      setLastResult(null)
    }
  }

  const card = {
    backgroundColor: 'var(--color-bg-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.75rem',
    padding: '1.25rem',
  }

  return (
    <main
      id="main-content"
      className="min-h-screen p-6"
      style={{ backgroundColor: 'var(--color-bg-secondary)' }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
              Admin / Ingestion
            </p>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
            >
              Painel de Ingestion
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Importe casos reais das fontes externas para o banco de dados. Sem autenticação (modo teste).
            </p>
          </div>
          <Link
            href="/"
            className="text-sm font-medium"
            style={{ color: 'var(--color-coral-hope)' }}
          >
            ← Voltar ao início
          </Link>
        </div>

        {/* Step 1: Seed */}
        <div style={card} className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}>
                Passo 1 — Seed DataSources
              </h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                Registra as fontes (FBI, Interpol, NCMEC, AMBER, CNPD) no banco. Seguro de rodar múltiplas vezes.
              </p>
            </div>
            <StatusBadge status={seedStatus} />
          </div>
          <button
            onClick={runSeed}
            disabled={seedStatus === 'loading'}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-deep-indigo)', fontFamily: 'var(--font-heading)' }}
          >
            {seedStatus === 'loading' ? 'Executando...' : 'Rodar Seed'}
          </button>
          {seedResult?.success && seedResult.data && (
            <div className="mt-3 p-3 rounded-lg text-sm" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
              {seedResult.data.message}
            </div>
          )}
          {seedResult && !seedResult.success && (
            <div className="mt-3 p-3 rounded-lg text-sm" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
              Erro: {seedResult.error?.message}
            </div>
          )}
        </div>

        {/* Step 2: Ingestion */}
        <div style={card} className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}>
                Passo 2 — Importar Casos
              </h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                Faz o fetch das APIs, normaliza e insere casos no banco. FBI: ~2s. Interpol: ~45-60s (1 página = 20 notices).
              </p>
            </div>
            <StatusBadge status={status} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => runIngestion('fbi')}
              disabled={status === 'loading'}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: '#1D4ED8', fontFamily: 'var(--font-heading)' }}
            >
              Importar FBI
            </button>
            <button
              onClick={() => runIngestion('interpol')}
              disabled={status === 'loading'}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: '#7C3AED', fontFamily: 'var(--font-heading)' }}
            >
              Importar Interpol
            </button>
            <button
              onClick={() => runIngestion('all')}
              disabled={status === 'loading'}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-coral-hope)', fontFamily: 'var(--font-heading)' }}
            >
              Importar Tudo
            </button>
          </div>
        </div>

        {/* Results */}
        {lastResult?.success && lastResult.data && (
          <div style={card} className="mb-4">
            <h2 className="text-base font-semibold mb-3" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}>
              Resultado da Ingestion
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              {[
                { label: 'Buscados', value: lastResult.data.summary.totalFetched },
                { label: 'Inseridos', value: lastResult.data.summary.totalInserted, highlight: true },
                { label: 'Atualizados', value: lastResult.data.summary.totalUpdated },
                { label: 'Ignorados', value: lastResult.data.summary.totalSkipped },
                { label: 'Falhas', value: lastResult.data.summary.totalFailed, error: lastResult.data.summary.totalFailed > 0 },
              ].map(({ label, value, highlight, error }) => (
                <div
                  key={label}
                  className="text-center p-3 rounded-lg"
                  style={{
                    backgroundColor: highlight ? '#D1FAE5' : error ? '#FEE2E2' : 'var(--color-bg-secondary)',
                  }}
                >
                  <p
                    className="text-2xl font-bold"
                    style={{ fontFamily: 'var(--font-mono)', color: highlight ? '#065F46' : error ? '#991B1B' : 'var(--color-deep-indigo)' }}
                  >
                    {value}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Per-source breakdown */}
            {lastResult.data.results.map((r) => (
              <div
                key={r.source}
                className="mb-2 p-3 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)' }}
              >
                <span className="font-semibold" style={{ color: 'var(--color-deep-indigo)', fontFamily: 'var(--font-heading)' }}>
                  {r.source.toUpperCase()}
                </span>
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  {' '}— {r.recordsFetched} buscados / {r.recordsInserted} inseridos / {r.recordsUpdated} atualizados
                  {' '}({(r.durationMs / 1000).toFixed(1)}s)
                </span>
                {r.errors.length > 0 && (
                  <div className="mt-1 text-xs" style={{ color: '#991B1B' }}>
                    {r.errors.slice(0, 3).map((e, i) => (
                      <div key={i}>{e.externalId ? `[${e.externalId}] ` : ''}{e.error}</div>
                    ))}
                    {r.errors.length > 3 && <div>...e mais {r.errors.length - 3} erros</div>}
                  </div>
                )}
              </div>
            ))}

            <p className="text-xs mt-2" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
              Duração total: {(lastResult.data.totalDurationMs / 1000).toFixed(1)}s •
              Iniciado: {new Date(lastResult.data.startedAt).toLocaleTimeString('pt-BR')} •
              Concluído: {new Date(lastResult.data.completedAt).toLocaleTimeString('pt-BR')}
            </p>
          </div>
        )}

        {lastResult && !lastResult.success && (
          <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5' }}>
            <p className="text-sm font-semibold" style={{ color: '#991B1B' }}>
              Erro: {lastResult.error?.code}
            </p>
            <p className="text-sm" style={{ color: '#991B1B' }}>{lastResult.error?.message}</p>
          </div>
        )}

        {/* Activity Log */}
        {log.length > 0 && (
          <div style={{ ...card, marginBottom: '1rem' }}>
            <h2 className="text-sm font-semibold mb-2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}>
              Log de Atividade
            </h2>
            <div
              className="rounded-lg p-3 text-xs space-y-1 max-h-48 overflow-y-auto"
              style={{ backgroundColor: 'var(--color-deep-indigo)', fontFamily: 'var(--font-mono)' }}
            >
              {log.map((entry, i) => (
                <div key={i} style={{ color: 'rgba(255,255,255,0.8)' }}>{entry}</div>
              ))}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div style={card}>
          <h2 className="text-sm font-semibold mb-3" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}>
            Links Rápidos
          </h2>
          <div className="flex flex-wrap gap-3 text-sm">
            {[
              { href: '/search', label: 'Buscar Casos' },
              { href: '/face-search', label: 'Busca por Foto' },
              { href: '/admin/embeddings', label: 'Gerar Embeddings' },
              { href: '/api/v1/data-sources', label: 'API: Data Sources' },
              { href: '/api/v1/cases', label: 'API: Cases' },
              { href: '/api/v1/public/stats', label: 'API: Stats' },
              { href: '/api/health', label: 'Health Check' },
            ].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors"
                style={{ color: 'var(--color-data-blue)' }}
              >
                {label} →
              </a>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
