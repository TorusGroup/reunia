'use client'

import { useState } from 'react'
import { z } from 'zod'

// =============================================================
// Sighting Form — Public form to report a sighting (Sprint 6)
// Mobile-first, GPS priority, no login required
// =============================================================

const sightingSchema = z.object({
  description: z.string().min(10, 'Descreva o que viu (mínimo 10 caracteres)').max(2000),
  locationText: z.string().optional(),
  seenAt: z.string().optional(),
  photoUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  caseId: z.string().uuid('ID de caso inválido').optional().or(z.literal('')),
})

type SightingFormData = z.infer<typeof sightingSchema>

interface SightingFormProps {
  defaultCaseId?: string
}

export function SightingForm({ defaultCaseId }: SightingFormProps) {
  const [formData, setFormData] = useState<SightingFormData>({
    description: '',
    locationText: '',
    seenAt: '',
    photoUrl: '',
    caseId: defaultCaseId ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'obtained' | 'denied'>('idle')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setGeoStatus('denied')
      return
    }
    setGeoStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoStatus('obtained')
      },
      () => {
        setGeoStatus('denied')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const validation = sightingSchema.safeParse(formData)
    if (!validation.success) {
      const fieldErrors = validation.error.flatten().fieldErrors
      setErrors(
        Object.fromEntries(
          Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0] ?? ''])
        )
      )
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/v1/sightings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validation.data,
          ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
          caseId: formData.caseId || undefined,
          photoUrl: formData.photoUrl || undefined,
          seenAt: formData.seenAt || undefined,
        }),
      })

      const data = await res.json()
      if (!data.success) {
        setErrors({ submit: data.error?.message ?? 'Erro ao enviar' })
        return
      }

      setSuccess(true)
    } catch {
      setErrors({ submit: 'Falha na conexão. Tente novamente.' })
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div
        className="rounded-xl border p-8 text-center"
        style={{
          backgroundColor: 'var(--color-found-green-light)',
          borderColor: 'var(--color-found-green)',
        }}
      >
        <p className="text-3xl mb-3">✅</p>
        <h3
          className="text-lg font-semibold mb-2"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-found-green-dark)' }}
        >
          Avistamento registrado!
        </h3>
        <p className="text-sm mb-4" style={{ color: 'var(--color-found-green-dark)' }}>
          Obrigado pela sua ajuda. Nossa equipe irá verificar em breve.
          Cada informação pode ser crucial para encontrar uma criança.
        </p>
        <p className="text-sm font-semibold" style={{ color: 'var(--color-coral-hope)' }}>
          CVV 188 — Apoio emocional disponível 24h
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Description */}
      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--color-text-primary)' }}
        >
          O que você viu? <span style={{ color: 'var(--color-coral-hope)' }}>*</span>
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Descreva a criança, o local, o que ela estava fazendo, com quem estava..."
          rows={4}
          className="w-full border rounded-xl px-4 py-3 text-sm resize-none"
          style={{
            borderColor: errors.description ? 'var(--color-coral-hope)' : 'var(--color-border)',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
          }}
          required
        />
        {errors.description && (
          <p className="text-xs mt-1" style={{ color: 'var(--color-coral-hope)' }}>
            {errors.description}
          </p>
        )}
      </div>

      {/* Location — GPS priority */}
      <div>
        <label
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Onde você viu?
        </label>
        <button
          type="button"
          onClick={handleGeolocate}
          className="w-full mb-2 py-2.5 text-sm font-medium rounded-xl border transition-all flex items-center justify-center gap-2"
          style={{
            borderColor: geoStatus === 'obtained' ? 'var(--color-found-green)' : 'var(--color-border)',
            backgroundColor: geoStatus === 'obtained' ? 'var(--color-found-green-light)' : 'var(--color-bg-secondary)',
            color: geoStatus === 'obtained' ? 'var(--color-found-green-dark)' : 'var(--color-text-secondary)',
          }}
        >
          {geoStatus === 'loading' ? '📡 Obtendo localização...' :
           geoStatus === 'obtained' ? `✅ GPS obtido (${coords?.lat.toFixed(4)}, ${coords?.lng.toFixed(4)})` :
           geoStatus === 'denied' ? '❌ GPS negado — use o campo abaixo' :
           '📍 Usar minha localização GPS (recomendado)'}
        </button>
        <input
          type="text"
          value={formData.locationText}
          onChange={(e) => setFormData((prev) => ({ ...prev, locationText: e.target.value }))}
          placeholder="Ou descreva o endereço: Rua, bairro, cidade..."
          className="w-full border rounded-xl px-4 py-2.5 text-sm"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
          }}
        />
      </div>

      {/* When */}
      <div>
        <label
          htmlFor="seenAt"
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Quando você viu? (opcional)
        </label>
        <input
          id="seenAt"
          type="datetime-local"
          value={formData.seenAt}
          onChange={(e) => setFormData((prev) => ({ ...prev, seenAt: e.target.value }))}
          className="w-full border rounded-xl px-4 py-2.5 text-sm"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
          }}
        />
      </div>

      {/* Case ID (optional) */}
      {!defaultCaseId && (
        <div>
          <label
            htmlFor="caseId"
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Número do caso (opcional — se você sabe para qual caso é)
          </label>
          <input
            id="caseId"
            type="text"
            value={formData.caseId}
            onChange={(e) => setFormData((prev) => ({ ...prev, caseId: e.target.value }))}
            placeholder="ID do caso (UUID)"
            className="w-full border rounded-xl px-4 py-2.5 text-sm"
            style={{
              borderColor: errors.caseId ? 'var(--color-coral-hope)' : 'var(--color-border)',
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-mono)',
            }}
          />
          {errors.caseId && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-coral-hope)' }}>
              {errors.caseId}
            </p>
          )}
        </div>
      )}

      {/* Submit error */}
      {errors.submit && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }}
        >
          {errors.submit}
        </div>
      )}

      {/* Privacy notice */}
      <div
        className="p-3 rounded-lg text-xs"
        style={{
          backgroundColor: 'var(--color-bg-tertiary)',
          color: 'var(--color-text-muted)',
        }}
      >
        <strong>Privacidade:</strong> Suas informações são usadas apenas para verificação do avistamento e
        podem ser compartilhadas com autoridades competentes. Você pode reportar anonimamente.
        LGPD Art. 11, II &ldquo;d&rdquo; — interesse vital da criança.
      </div>

      <button
        type="submit"
        disabled={isLoading || !formData.description}
        className="w-full py-3.5 text-sm font-bold rounded-xl text-white transition-all disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-coral-hope)' }}
      >
        {isLoading ? 'Enviando...' : 'Enviar Avistamento'}
      </button>
    </form>
  )
}
