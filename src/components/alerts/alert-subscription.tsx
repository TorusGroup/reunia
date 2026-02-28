'use client'

// =============================================================
// AlertSubscription — Subscribe to geolocation-based alerts
// Channels: WhatsApp (primary), Email, SMS
// Sprint 4, E5
// =============================================================

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Channel = 'whatsapp' | 'email' | 'sms'
type Frequency = 'max3' | 'urgent_only' | 'unlimited'

interface FormState {
  channel: Channel
  whatsapp: string
  email: string
  sms: string
  location: string
  radiusKm: number
  frequency: Frequency
  consent: boolean
}

const INITIAL: FormState = {
  channel: 'whatsapp',
  whatsapp: '',
  email: '',
  sms: '',
  location: '',
  radiusKm: 100,
  frequency: 'max3',
  consent: false,
}

export function AlertSubscription() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(changed: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...changed }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const contactIdentifier =
        form.channel === 'whatsapp' ? form.whatsapp :
        form.channel === 'email' ? form.email :
        form.sms

      const res = await fetch('/api/v1/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: form.channel,
          contactIdentifier,
          radiusKm: form.radiusKm,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        if (res.status === 429) {
          setError('Muitas tentativas. Aguarde alguns minutos.')
        } else {
          setError(data.error?.message ?? 'Erro ao cadastrar. Tente novamente.')
        }
        return
      }

      setSuccess(true)
    } catch {
      setError('Falha na conexão. Verifique sua internet e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const contactValue = form.channel === 'whatsapp' ? form.whatsapp : form.channel === 'email' ? form.email : form.sms
  const canSubmit = !!form.location && !!contactValue && form.consent

  if (success) {
    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }}
        role="alert"
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: 'var(--color-found-green-light)' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-found-green)" strokeWidth="2.5" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2
          className="text-xl font-bold mb-2"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
        >
          Cadastrado!
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          Você receberá alertas de desaparecimentos num raio de{' '}
          <strong>{form.radiusKm}km</strong> de{' '}
          <strong>{form.location}</strong>. Um link de cancelamento estará em cada mensagem.
        </p>
        <button
          onClick={() => { setSuccess(false); setForm(INITIAL) }}
          className="text-sm transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Cancelar inscrição
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl p-6 space-y-6"
      style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-card)' }}
    >
      {/* Channel selector */}
      <fieldset>
        <legend
          className="text-sm font-semibold mb-3"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
        >
          Canal de alerta
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'whatsapp', label: 'WhatsApp', icon: '💬' },
            { value: 'email', label: 'E-mail', icon: '✉️' },
            { value: 'sms', label: 'SMS', icon: '📱' },
          ] as const).map(({ value, label, icon }) => (
            <label
              key={value}
              className="flex flex-col items-center gap-1.5 p-3 rounded-lg cursor-pointer transition-all"
              style={{
                border: form.channel === value
                  ? '2px solid var(--color-coral-hope)'
                  : '1.5px solid var(--color-border)',
                backgroundColor: form.channel === value ? '#FFF8F7' : 'var(--color-bg-primary)',
              }}
            >
              <input
                type="radio"
                name="channel"
                value={value}
                checked={form.channel === value}
                onChange={() => update({ channel: value })}
                className="sr-only"
              />
              <span className="text-xl">{icon}</span>
              <span
                className="text-sm font-medium"
                style={{
                  color: form.channel === value ? 'var(--color-coral-hope)' : 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Channel-specific contact field */}
      {form.channel === 'whatsapp' && (
        <Input
          label="Número WhatsApp (com DDD)"
          type="tel"
          value={form.whatsapp}
          onChange={(e) => update({ whatsapp: e.target.value })}
          placeholder="+55 (11) 99999-0000"
          required
          autoComplete="tel"
        />
      )}
      {form.channel === 'email' && (
        <Input
          label="E-mail"
          type="email"
          value={form.email}
          onChange={(e) => update({ email: e.target.value })}
          placeholder="seu@email.com"
          required
          autoComplete="email"
        />
      )}
      {form.channel === 'sms' && (
        <Input
          label="Número de telefone"
          type="tel"
          value={form.sms}
          onChange={(e) => update({ sms: e.target.value })}
          placeholder="+55 (11) 99999-0000"
          required
          autoComplete="tel"
        />
      )}

      {/* Location */}
      <Input
        label="Sua localização (cidade ou CEP)"
        value={form.location}
        onChange={(e) => update({ location: e.target.value })}
        placeholder="São Paulo, SP"
        required
        rightIcon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        }
        hint="Usada apenas para filtrar alertas próximos. Não armazenada publicamente."
      />

      {/* Radius slider */}
      <fieldset>
        <legend className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}>
          Raio de alertas:{' '}
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-coral-hope)' }}>
            {form.radiusKm} km
          </span>
        </legend>
        <input
          type="range"
          min={25}
          max={500}
          step={25}
          value={form.radiusKm}
          onChange={(e) => update({ radiusKm: Number(e.target.value) })}
          className="w-full"
          style={{ accentColor: 'var(--color-coral-hope)' }}
          aria-valuemin={25}
          aria-valuemax={500}
          aria-valuenow={form.radiusKm}
          aria-label="Raio de alertas em quilômetros"
        />
        <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          <span>25 km</span>
          <span>250 km</span>
          <span>500 km</span>
        </div>
      </fieldset>

      {/* Frequency */}
      <fieldset>
        <legend className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}>
          Frequência máxima
        </legend>
        <div className="space-y-2">
          {([
            { value: 'max3', label: 'Máx. 3 alertas por dia', desc: 'Recomendado' },
            { value: 'urgent_only', label: 'Apenas urgentes', desc: 'Casos críticos (24h)' },
            { value: 'unlimited', label: 'Sem limite', desc: 'Todos os alertas da área' },
          ] as const).map(({ value, label, desc }) => (
            <label key={value} className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="frequency"
                value={value}
                checked={form.frequency === value}
                onChange={() => update({ frequency: value })}
                className="w-4 h-4 mt-0.5"
                style={{ accentColor: 'var(--color-coral-hope)' }}
              />
              <div>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {label}
                </span>
                <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>
                  {desc}
                </span>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Consent */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={form.consent}
          onChange={(e) => update({ consent: e.target.checked })}
          className="w-4 h-4 mt-0.5 flex-shrink-0"
          style={{ accentColor: 'var(--color-coral-hope)' }}
          required
        />
        <span className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
          Li e aceito os{' '}
          <a href="/termos" className="underline" style={{ color: 'var(--color-data-blue)' }}>
            Termos de Uso
          </a>{' '}
          e a{' '}
          <a href="/privacidade" className="underline" style={{ color: 'var(--color-data-blue)' }}>
            Política de Privacidade
          </a>.
          <span className="text-red-500 ml-1" aria-label="obrigatório">*</span>
        </span>
      </label>

      {/* Error message */}
      {error && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{ backgroundColor: 'rgba(232, 99, 74, 0.08)', color: 'var(--color-coral-hope)' }}
          role="alert"
        >
          {error}
        </div>
      )}

      <Button
        type="submit"
        width="full"
        loading={submitting}
        disabled={!canSubmit}
      >
        Cadastrar para Receber Alertas
      </Button>
    </form>
  )
}
