import type { Metadata } from 'next'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { SearchPageClient } from '@/components/search/search-page-client'

// =============================================================
// Search Page — Public Route Group (Sprint 4, E5-S02)
// Server Component wrapper; client logic in SearchPageClient
// =============================================================

export const metadata: Metadata = {
  title: 'Buscar Criança Desaparecida',
  description:
    'Busca unificada de crianças desaparecidas. Dados de FBI, Interpol, NCMEC e fontes brasileiras.',
  robots: { index: true, follow: true },
}

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const query = params.q ?? ''
  const page = Number(params.page ?? 1)

  return (
    <>
      <Header />
      <main
        id="main-content"
        className="min-h-screen"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        <SearchPageClient initialQuery={query} initialPage={page} />
      </main>
      <Footer />
    </>
  )
}
