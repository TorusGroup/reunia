import type { Metadata } from 'next'
import { LeDashboardAnalytics } from '@/components/le-dashboard/sections/analytics'

export const metadata: Metadata = { title: 'Analytics — Painel LE' }

export default function LeAnalyticsPage() {
  return <LeDashboardAnalytics />
}
