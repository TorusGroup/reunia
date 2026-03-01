'use client'

import { useState } from 'react'

// =============================================================
// CaseAnalysis — AI-powered case analysis panel
// Feature 1: AI Case Analyst
// =============================================================

interface CaseAnalysisData {
  riskProfile: {
    level: 'critical' | 'high' | 'medium' | 'low'
    score: number
    factors: string[]
  }
  patterns: {
    similarCasesInRegion: number
    similarCasesInPeriod: number
    observations: string[]
  }
  timeline: {
    daysMissing: number
    estimatedPhase: string
    phaseDescription: string
  }
  searchSuggestions: string[]
  summary: string
  generatedAt: string
}

interface CaseAnalysisProps {
  caseId: string
}

const RISK_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  critical: {
    bg: 'var(--color-danger-light)',
    border: 'var(--color-danger)',
    text: 'var(--color-danger)',
    label: 'CRITICO',
  },
  high: {
    bg: 'var(--color-alert-amber-light)',
    border: 'var(--color-alert-amber)',
    text: '#92400E',
    label: 'ALTO',
  },
  medium: {
    bg: 'var(--color-data-blue-light)',
    border: 'var(--color-data-blue)',
    text: 'var(--color-data-blue-dark)',
    label: 'MEDIO',
  },
  low: {
    bg: 'var(--color-bg-tertiary)',
    border: 'var(--color-border)',
    text: 'var(--color-text-secondary)',
    label: 'BAIXO',
  },
}

export function CaseAnalysis({ caseId }: CaseAnalysisProps) {
  const [analysis, setAnalysis] = useState<CaseAnalysisData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  async function runAnalysis() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/v1/cases/${caseId}/analyze`, { method: 'POST' })
      const json = await res.json()

      if (json.success) {
        setAnalysis(json.data)
      } else {
        setError(json.error?.message ?? 'Falha na análise')
      }
    } catch {
      setError('Erro de conexão ao servidor')
    } finally {
      setLoading(false)
    }
  }

  if (!analysis) {
    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--color-border)' }}
      >
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{
            backgroundColor: 'var(--color-deep-indigo)',
            color: 'white',
            fontFamily: 'var(--font-heading)',
            fontSize: '0.8rem',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.06em',
          }}
        >
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
            </svg>
            Analise com IA
          </div>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--color-coral-hope)', fontSize: '0.65rem' }}
          >
            AGENTIC
          </span>
        </div>
        <div className="p-6 text-center" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Nossa IA analisa este caso para gerar perfil de risco, identificar padroes e sugerir acoes de busca.
          </p>
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold text-sm transition-all disabled:opacity-50"
            style={{
              backgroundColor: 'var(--color-coral-hope)',
              fontFamily: 'var(--font-heading)',
            }}
          >
            {loading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                Analisar com IA
              </>
            )}
          </button>
          {error && (
            <p className="text-sm mt-3" style={{ color: 'var(--color-danger)' }}>
              {error}
            </p>
          )}
        </div>
      </div>
    )
  }

  const risk = RISK_COLORS[analysis.riskProfile.level]

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${risk.border}` }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between cursor-pointer"
        style={{
          backgroundColor: 'var(--color-deep-indigo)',
          color: 'white',
          fontFamily: 'var(--font-heading)',
          fontSize: '0.8rem',
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.06em',
        }}
      >
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          Analise IA — Risco {risk.label}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: risk.bg, color: risk.text, fontSize: '0.65rem', fontWeight: 700 }}
          >
            {analysis.riskProfile.score}/100
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-5" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
          {/* Summary */}
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            {analysis.summary}
          </p>

          {/* Risk factors */}
          <div>
            <h4
              className="text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: 'var(--color-warm-gray)' }}
            >
              Fatores de risco
            </h4>
            <div className="space-y-1.5">
              {analysis.riskProfile.factors.map((factor, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: risk.border }}
                  />
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {factor}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Phase */}
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-warm-gray)' }}>
              {analysis.timeline.estimatedPhase}
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {analysis.timeline.phaseDescription}
            </p>
          </div>

          {/* Patterns */}
          {analysis.patterns.observations.length > 0 && (
            <div>
              <h4
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: 'var(--color-warm-gray)' }}
              >
                Padroes identificados
              </h4>
              <div className="space-y-1.5">
                {analysis.patterns.observations.map((obs, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: 'var(--color-data-blue)' }}
                    />
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {obs}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search suggestions */}
          <div>
            <h4
              className="text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: 'var(--color-warm-gray)' }}
            >
              Sugestoes de busca
            </h4>
            <ol className="space-y-1.5 list-decimal list-inside">
              {analysis.searchSuggestions.map((sug, i) => (
                <li
                  key={i}
                  className="text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {sug}
                </li>
              ))}
            </ol>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
              Gerado em {new Date(analysis.generatedAt).toLocaleString('pt-BR')}
            </p>
            <button
              onClick={runAnalysis}
              className="text-xs font-medium transition-colors"
              style={{ color: 'var(--color-coral-hope)' }}
            >
              Reanalisar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
