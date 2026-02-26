import type { Metadata } from 'next'
import { CasesManagement } from '@/components/le-dashboard/sections/cases-management'

export const metadata: Metadata = { title: 'Gestão de Casos — Painel LE' }

export default function LeCasesPage() {
  return <CasesManagement />
}
