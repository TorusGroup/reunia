import type { Metadata } from 'next'
import { SightingsReview } from '@/components/le-dashboard/sections/sightings-review'

export const metadata: Metadata = { title: 'Avistamentos — Painel LE' }

export default function LeSightingsPage() {
  return <SightingsReview />
}
