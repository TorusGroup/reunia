import type { Metadata } from 'next'
import { MatchValidation } from '@/components/le-dashboard/sections/match-validation'

export const metadata: Metadata = { title: 'Validação de Correspondências — Painel LE' }

export default function LeValidationPage() {
  return <MatchValidation />
}
