'use client'

import { BroadcastForm } from '@/components/le-dashboard/broadcast-form'

// =============================================================
// Broadcast Section — AMBER Alert creation and management (Sprint 6, E7-S06)
// =============================================================

// Mock active AMBER alerts
const MOCK_ACTIVE_ALERTS = [
  {
    id: 'a1',
    caseNumber: 'BR-2026-001',
    childName: 'Ana Silva',
    status: 'broadcasting',
    sentAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    recipientCount: 1842,
    createdBy: 'Det. Carlos Lima',
  },
]

export function BroadcastSection() {
  const handleBroadcast = async (caseId: string, approve: boolean) => {
    const res = await fetch('/api/v1/alerts/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') ?? '' : ''}`,
      },
      body: JSON.stringify({ caseId, approve }),
    })

    const data = await res.json()
    if (!data.success) throw new Error(data.error?.message ?? 'Erro ao criar alerta')
    return { alertId: data.data.alertId, status: data.data.status }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          Alerta Âmbar
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Emita alertas de emergência para crianças em risco imediato
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <div>
          <h2
            className="text-base font-semibold mb-4"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            Novo Alerta
          </h2>
          <div
            className="rounded-xl border p-6"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              borderColor: 'var(--color-border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <BroadcastForm onSubmit={handleBroadcast} />
          </div>
        </div>

        {/* Active alerts */}
        <div>
          <h2
            className="text-base font-semibold mb-4"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            Alertas Ativos
          </h2>
          {MOCK_ACTIVE_ALERTS.length === 0 ? (
            <div
              className="rounded-xl border p-8 text-center"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-primary)' }}
            >
              <p style={{ color: 'var(--color-text-muted)' }}>Nenhum alerta ativo no momento.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {MOCK_ACTIVE_ALERTS.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-xl border p-4"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    borderColor: 'var(--color-border)',
                    borderLeft: '4px solid var(--color-coral-hope)',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: 'var(--color-coral-hope)' }}
                      >
                        ⚠ ATIVO
                      </span>
                      <span
                        className="text-xs"
                        style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
                      >
                        #{alert.caseNumber}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(alert.sentAt).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="font-semibold text-sm mb-1" style={{ color: 'var(--color-text-primary)' }}>
                    {alert.childName}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    Emitido por: {alert.createdBy} &middot;{' '}
                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                      {alert.recipientCount.toLocaleString()} destinatários
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Guidelines */}
      <div
        className="rounded-xl border p-6"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderColor: 'var(--color-border)',
        }}
      >
        <h3
          className="font-semibold mb-3"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          Critérios para Emissão de Alerta Âmbar
        </h3>
        <ul className="space-y-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          <li>• Criança menor de 18 anos em risco iminente de dano grave ou morte</li>
          <li>• Caso de abdução confirmada ou fortemente suspeita</li>
          <li>• Informações suficientes para ajudar o público a identificar criança, suspeito ou veículo</li>
          <li>• Alerta aprovado pelo supervisor responsável (salvo auto-aprovação em emergências)</li>
        </ul>
      </div>
    </div>
  )
}
