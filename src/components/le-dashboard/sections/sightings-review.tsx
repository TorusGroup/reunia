'use client'

import { useState } from 'react'
import { SightingCard } from '@/components/le-dashboard/sighting-card'
import type { SightingData } from '@/components/le-dashboard/sighting-card'

// =============================================================
// Sightings Review Section — Sprint 6, E7-S04
// Mock data — API integration Sprint 7+
// =============================================================

const MOCK_SIGHTINGS: SightingData[] = [
  {
    id: 's1',
    caseId: '1',
    caseNumber: 'BR-2026-001',
    description: 'Vi uma criança que se parece com a foto do alerta perto da estação de metrô Consolação, estava acompanhada de um adulto desconhecido.',
    seenAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    locationText: 'Metrô Consolação, São Paulo, SP',
    latitude: -23.5569,
    longitude: -46.6628,
    photoUrl: null,
    status: 'pending',
    isAnonymous: true,
    reporterName: null,
    createdAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 's2',
    caseId: null,
    caseNumber: null,
    description: 'Criança sozinha e chorando na rua, aparenta ter entre 7 e 10 anos, cabelo escuro, blusa amarela. Estava próxima ao parque.',
    seenAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    locationText: 'Parque Trianon, Av. Paulista, São Paulo',
    latitude: -23.5613,
    longitude: -46.6558,
    photoUrl: 'https://placehold.co/80x80/E8634A/white?text=Foto',
    status: 'reviewing',
    isAnonymous: false,
    reporterName: 'Carlos Mendes',
    createdAt: new Date(Date.now() - 4.5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 's3',
    caseId: '2',
    caseNumber: 'BR-2026-018',
    description: 'Avistei a criança na praia de Copacabana, na altura do posto 5. Estava correndo e parecia assustada.',
    seenAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    locationText: 'Praia de Copacabana, Posto 5, Rio de Janeiro',
    latitude: -22.9714,
    longitude: -43.1829,
    photoUrl: null,
    status: 'confirmed',
    isAnonymous: false,
    reporterName: 'Maria das Graças',
    createdAt: new Date(Date.now() - 7.5 * 60 * 60 * 1000).toISOString(),
  },
]

export function SightingsReview() {
  const [sightings, setSightings] = useState<SightingData[]>(MOCK_SIGHTINGS)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const handleReview = (id: string, status: 'confirmed' | 'rejected') => {
    setSightings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s))
    )
    console.log('Review sighting', id, status)
  }

  const filtered = statusFilter === 'all'
    ? sightings
    : sightings.filter((s) => s.status === statusFilter)

  const pendingCount = sightings.filter((s) => s.status === 'pending' || s.status === 'reviewing').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}>
            Avistamentos
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {pendingCount} aguardando revisão &middot; {sightings.length} total
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'reviewing', 'confirmed', 'rejected'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 text-xs font-medium rounded-full border transition-all"
            style={{
              backgroundColor: statusFilter === s ? 'var(--color-deep-indigo)' : 'transparent',
              color: statusFilter === s ? 'white' : 'var(--color-text-secondary)',
              borderColor: statusFilter === s ? 'var(--color-deep-indigo)' : 'var(--color-border)',
            }}
          >
            {s === 'all' ? 'Todos' : s === 'pending' ? 'Pendente' : s === 'reviewing' ? 'Em revisão' : s === 'confirmed' ? 'Confirmado' : 'Rejeitado'}
          </button>
        ))}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-primary)' }}
        >
          <p style={{ color: 'var(--color-text-muted)' }}>Nenhum avistamento neste status.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((sighting) => (
            <SightingCard
              key={sighting.id}
              sighting={sighting}
              onReview={handleReview}
              onLinkCase={(id) => console.log('Link case', id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
