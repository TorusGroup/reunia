'use client'

import { useState } from 'react'
import { z } from 'zod'

// =============================================================
// Broadcast Form — AMBER Alert creation (Sprint 6, E7-S06)
// =============================================================

const broadcastSchema = z.object({
  caseId: z.string().uuid('ID do caso inválido'),
  approve: z.boolean(),
})

interface BroadcastFormProps {
  onSubmit: (caseId: string, approve: boolean) => Promise<{ alertId: string; status: string }>
}

export function BroadcastForm({ onSubmit }: BroadcastFormProps) {
  const [caseId, setCaseId] = useState('')
  const [approve, setApprove] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ alertId: string; status: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const validation = broadcastSchema.safeParse({ caseId, approve })
    if (!validation.success) {
      const fieldErrors = validation.error.flatten().fieldErrors
      setErrors({
        caseId: fieldErrors.caseId?.[0] ?? '',
      })
      return
    }

    setIsLoading(true)
    try {
      const res = await onSubmit(caseId, approve)
      setResult(res)
      setCaseId('')
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Erro ao criar alerta' })
    } finally {
      setIsLoading(false)
    }
  }

  if (result) {
    return (
      <div
        className="rounded-xl border p-8 text-center"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderColor: 'var(--color-found-green)',
        }}
      >
        <p className="text-2xl mb-3">✅</p>
        <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--color-found-green-dark)' }}>
          Alerta Âmbar {result.status === 'broadcasting' ? 'enviado!' : 'criado — aguardando aprovação'}
        </h3>
        <p
          className="text-sm mb-4"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
        >
          ID: {result.alertId}
        </p>
        <button
          onClick={() => setResult(null)}
          className="px-6 py-2 text-sm font-semibold rounded-lg text-white"
          style={{ backgroundColor: 'var(--color-deep-indigo)' }}
        >
          Criar Outro Alerta
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div
        className="mb-6 p-4 rounded-lg text-sm"
        style={{
          backgroundColor: 'rgba(232, 99, 74, 0.08)',
          borderLeft: '4px solid var(--color-coral-hope)',
          color: 'var(--color-text-primary)',
        }}
      >
        <strong style={{ color: 'var(--color-coral-hope)' }}>⚠ Alerta Âmbar</strong> é reservado para
        casos de abdução confirmada ou desaparecimento de alto risco. Use com responsabilidade — alertas
        desnecessários reduzem a eficácia do sistema.
      </div>

      <div className="space-y-5">
        {/* Case ID */}
        <div>
          <label
            className="block text-sm font-medium mb-1.5"
            htmlFor="caseId"
            style={{ color: 'var(--color-text-primary)' }}
          >
            ID do Caso (UUID)
          </label>
          <input
            id="caseId"
            type="text"
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="w-full border rounded-lg px-3 py-2.5 text-sm"
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

        {/* Approve toggle */}
        <div className="flex items-center gap-3">
          <input
            id="approve"
            type="checkbox"
            checked={approve}
            onChange={(e) => setApprove(e.target.checked)}
            className="rounded w-4 h-4"
          />
          <label htmlFor="approve" className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
            Aprovar e enviar imediatamente (sem aprovação adicional do supervisor)
          </label>
        </div>

        {errors.submit && (
          <p className="text-sm" style={{ color: 'var(--color-coral-hope)' }}>
            {errors.submit}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading || !caseId}
          className="w-full py-3 text-sm font-bold rounded-lg text-white transition-all disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-coral-hope)' }}
        >
          {isLoading ? 'Criando alerta...' : `⚠ Emitir Alerta Âmbar${approve ? ' e Enviar' : ''}`}
        </button>
      </div>
    </form>
  )
}
