import type { Metadata } from 'next'
import { BroadcastSection } from '@/components/le-dashboard/sections/broadcast'

export const metadata: Metadata = { title: 'Alerta Âmbar — Painel LE' }

export default function LeBroadcastPage() {
  return <BroadcastSection />
}
