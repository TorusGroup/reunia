'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// =============================================================
// GeoAlertsDashboard — Alert feed + subscription form
// Feature 2: Geo-Alert System
// =============================================================

interface AlertItem {
  id: string
  type: string
  caseNumber: string
  personName: string
  approximateAge: number | null
  gender: string | null
  location: string | null
  country: string | null
  urgency: string
  reportedAt: string
  imageUrl: string | null
  message: string
}

const URGENCY_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'var(--color-danger-light)', text: 'var(--color-danger)' },
  high: { bg: 'var(--color-alert-amber-light)', text: '#92400E' },
  standard: { bg: 'var(--color-data-blue-light)', text: 'var(--color-data-blue-dark)' },
  low: { bg: 'var(--color-bg-tertiary)', text: 'var(--color-text-secondary)' },
}

const REGIONS = [
  { code: '', label: 'Todas as regioes' },
  { code: 'US', label: 'Estados Unidos' },
  { code: 'BR', label: 'Brasil' },
  { code: 'GB', label: 'Reino Unido' },
  { code: 'DE', label: 'Alemanha' },
  { code: 'FR', label: 'Franca' },
  { code: 'MX', label: 'Mexico' },
  { code: 'CO', label: 'Colombia' },
  { code: 'AR', label: 'Argentina' },
]

export function GeoAlertsDashboard() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [totalSubscribers, setTotalSubscribers] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedRegion, setSelectedRegion] = useState('')

  // Subscription form
  const [email, setEmail] = useState('')
  const [subRegion, setSubRegion] = useState('')
  const [alertTypes, setAlertTypes] = useState<string[]>(['new_case', 'sighting_nearby'])
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    async function fetchAlerts() {
      setLoading(true)
      try {
        const url = selectedRegion
          ? `/api/v1/geo-alerts?region=${selectedRegion}`
          : '/api/v1/geo-alerts'
        const res = await fetch(url)
        const json = await res.json()
        if (json.success) {
          setAlerts(json.data.alerts)
          setTotalSubscribers(json.data.totalSubscribers)
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }
    fetchAlerts()
  }, [selectedRegion])

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !subRegion || alertTypes.length === 0) return

    setSubmitting(true)
    setSubmitResult(null)

    try {
      const res = await fetch('/api/v1/geo-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, region: subRegion, alertTypes }),
      })
      const json = await res.json()
      if (json.success) {
        setSubmitResult({ success: true, message: json.data.message })
        setEmail('')
      } else {
        setSubmitResult({ success: false, message: json.error?.message ?? 'Erro ao inscrever' })
      }
    } catch {
      setSubmitResult({ success: false, message: 'Erro de conexao' })
    } finally {
      setSubmitting(false)
    }
  }

  function toggleAlertType(type: string) {
    setAlertTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Alert Feed (2/3) */}
      <div className="md:col-span-2 space-y-4">
        {/* Filter */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-body)',
            }}
          >
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Ultimos 7 dias
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <span
              className="inline-block w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--color-coral-hope)', borderTopColor: 'transparent' }}
            />
            <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>Carregando alertas...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div
            className="text-center py-12 rounded-xl"
            style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px dashed var(--color-border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Nenhum alerta recente para esta regiao.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const urgencyColor = URGENCY_COLORS[alert.urgency] ?? URGENCY_COLORS.standard
              const reportedDate = new Date(alert.reportedAt).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })

              return (
                <Link
                  key={alert.id}
                  href={`/case/${alert.id}`}
                  className="flex gap-3 p-4 rounded-xl transition-all"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  {/* Image */}
                  <div
                    className="w-14 h-14 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                  >
                    {alert.imageUrl ? (
                      <img
                        src={`/api/v1/proxy-image?url=${encodeURIComponent(alert.imageUrl)}`}
                        alt={alert.personName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" aria-hidden="true">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-xs font-bold uppercase px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: urgencyColor.bg,
                          color: urgencyColor.text,
                          fontSize: '0.6rem',
                        }}
                      >
                        {alert.urgency}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {alert.caseNumber}
                      </span>
                    </div>
                    <p
                      className="text-sm font-semibold mt-1 truncate"
                      style={{ color: 'var(--color-deep-indigo)', fontFamily: 'var(--font-heading)' }}
                    >
                      {alert.personName}
                      {alert.approximateAge ? `, ${alert.approximateAge} anos` : ''}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                      {alert.location ?? 'Local desconhecido'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {reportedDate}
                    </p>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center flex-shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" aria-hidden="true">
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Subscription sidebar (1/3) */}
      <div className="space-y-4">
        {/* Social proof */}
        <div
          className="rounded-xl p-4 text-center"
          style={{ backgroundColor: 'var(--color-deep-indigo)' }}
        >
          <p
            className="text-2xl font-bold text-white"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {totalSubscribers.toLocaleString('pt-BR')}
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
            pessoas ja recebem alertas
          </p>
        </div>

        {/* Subscribe form */}
        <form
          onSubmit={handleSubscribe}
          className="rounded-xl p-5 space-y-4"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-elevated)',
          }}
        >
          <h3
            className="text-base font-semibold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
          >
            Inscrever para alertas
          </h3>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>
              Regiao
            </label>
            <select
              value={subRegion}
              onChange={(e) => setSubRegion(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="">Selecione a regiao</option>
              {REGIONS.filter((r) => r.code).map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--color-text-secondary)' }}>
              Tipos de alerta
            </label>
            <div className="space-y-2">
              {[
                { key: 'new_case', label: 'Novos casos na minha regiao' },
                { key: 'resolved', label: 'Casos resolvidos' },
                { key: 'sighting_nearby', label: 'Avistamentos proximos' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertTypes.includes(key)}
                    onChange={() => toggleAlertType(key)}
                    className="rounded"
                    style={{ accentColor: 'var(--color-coral-hope)' }}
                  />
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-3 rounded-lg text-white font-semibold text-sm transition-all disabled:opacity-50"
            style={{
              backgroundColor: 'var(--color-coral-hope)',
              fontFamily: 'var(--font-heading)',
            }}
          >
            {submitting ? 'Inscrevendo...' : 'Inscrever-se'}
          </button>

          {submitResult && (
            <p
              className="text-sm text-center"
              style={{ color: submitResult.success ? 'var(--color-found-green)' : 'var(--color-danger)' }}
            >
              {submitResult.message}
            </p>
          )}
        </form>

        {/* Info */}
        <div
          className="rounded-xl p-4 space-y-2"
          style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Seus dados sao protegidos pela LGPD. Voce pode cancelar a qualquer momento.
          </p>
        </div>
      </div>
    </div>
  )
}
