import type { Metadata } from 'next'
import { LeDashboardOverview } from '@/components/le-dashboard/sections/overview'

// =============================================================
// LE Dashboard — Main Overview Page (Sprint 6, E7-S01)
// =============================================================

export const metadata: Metadata = {
  title: 'Visão Geral — Painel LE',
}

export default function LeDashboardPage() {
  return <LeDashboardOverview />
}
