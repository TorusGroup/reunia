import type { Metadata } from 'next'
import { AdminDocsClient } from '@/components/admin/admin-docs-client'

// =============================================================
// Admin Panel — Project Documentation Viewer
// Lists all project docs and opens them in an elegant modal
// =============================================================

export const metadata: Metadata = {
  title: 'Admin — Documentacao',
  robots: { index: false, follow: false },
}

export default function AdminPage() {
  return <AdminDocsClient />
}
