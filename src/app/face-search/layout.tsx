import type { Metadata } from 'next'

// =============================================================
// Face Search Layout — provides metadata for the client page
// =============================================================

export const metadata: Metadata = {
  title: 'Busca por Foto — Reconhecimento Facial',
  description:
    'Envie uma foto e buscamos correspondências em nosso banco de casos de crianças desaparecidas usando reconhecimento facial no seu navegador.',
  robots: { index: true, follow: true },
}

export default function FaceSearchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
