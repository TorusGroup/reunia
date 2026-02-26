import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

// =============================================================
// Root Layout — ReunIA (E1-S08)
// Providers, fonts, metadata
// =============================================================

// Fonts — loaded via next/font (auto-optimized)
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

// Plus Jakarta Sans must be loaded as custom font since next/font
// doesn't have it — use @next/font/google with display swap
// For now using Inter as fallback; add Plus Jakarta via <link> in head

export const metadata: Metadata = {
  title: {
    default: 'ReunIA — Inteligência Artificial Reunindo Famílias',
    template: '%s | ReunIA',
  },
  description:
    'Plataforma de busca unificada de crianças desaparecidas com inteligência artificial. Reconhecimento facial, alertas inteligentes e dados federados de múltiplas fontes.',
  keywords: [
    'crianças desaparecidas',
    'busca',
    'inteligência artificial',
    'reconhecimento facial',
    'AMBER Alert',
    'Brasil',
    'missing children',
    'busca de pessoas',
    'alertas geolocalizados',
    'reunia',
  ],
  authors: [{ name: 'ReunIA Team' }],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'ReunIA',
    title: 'ReunIA — Inteligência Artificial Reunindo Famílias',
    description:
      'Plataforma de busca unificada de crianças desaparecidas com inteligência artificial. Reconhecimento facial, alertas inteligentes e dados federados de múltiplas fontes.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ReunIA — Reunindo Famílias com IA',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ReunIA — Inteligência Artificial Reunindo Famílias',
    description:
      'Plataforma de busca unificada de crianças desaparecidas com inteligência artificial.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // IMPORTANT: Case detail pages set their own robots meta (noindex for privacy)
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFBFC' },
    { media: '(prefers-color-scheme: dark)', color: '#2D3561' },
  ],
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <head>
        {/* Plus Jakarta Sans — loaded here since next/font/google doesn't include it */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Skip to main content — accessibility */}
        <a href="#main-content" className="skip-link">
          Ir para conteúdo principal
        </a>

        {children}
      </body>
    </html>
  )
}
