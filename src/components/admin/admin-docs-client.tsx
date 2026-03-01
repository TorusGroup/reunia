'use client'

// =============================================================
// AdminDocsClient — Project documentation browser
// Lists all .md files by category, opens in fullscreen modal
// Zero external dependencies for markdown rendering
// =============================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------
interface DocFile {
  filePath: string
  name: string
  category: string
  size: number
  modifiedAt: string
}

interface DocsResponse {
  success: boolean
  files: DocFile[]
  categoryLabels: Record<string, string>
  total: number
  error?: string
}

interface DocContentResponse {
  success: boolean
  content: string
  metadata: {
    name: string
    path: string
    size: number
    modifiedAt: string
  }
  error?: string
}

// ---------------------------------------------------------------
// Simple markdown to HTML converter (no dependencies)
// ---------------------------------------------------------------
function markdownToHtml(md: string): string {
  let html = md

  // Escape HTML entities first (but preserve our intentional tags later)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre class="md-code-block"><code>${code.trim()}</code></pre>`
  })

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')

  // Headers
  html = html.replace(/^######\s+(.+)$/gm, '<h6 class="md-h6">$1</h6>')
  html = html.replace(/^#####\s+(.+)$/gm, '<h5 class="md-h5">$1</h5>')
  html = html.replace(/^####\s+(.+)$/gm, '<h4 class="md-h4">$1</h4>')
  html = html.replace(/^###\s+(.+)$/gm, '<h3 class="md-h3">$1</h3>')
  html = html.replace(/^##\s+(.+)$/gm, '<h2 class="md-h2">$1</h2>')
  html = html.replace(/^#\s+(.+)$/gm, '<h1 class="md-h1">$1</h1>')

  // Bold and italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')

  // Strikethrough
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>')

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr class="md-hr" />')

  // Tables
  html = html.replace(
    /((?:\|[^\n]+\|\n)+)/g,
    (tableBlock) => {
      const rows = tableBlock.trim().split('\n')
      if (rows.length < 2) return tableBlock

      let tableHtml = '<div class="md-table-wrap"><table class="md-table">'

      rows.forEach((row, idx) => {
        // Skip separator row (|---|---|)
        if (/^\|[\s-:|]+\|$/.test(row)) return

        const cells = row
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim())

        if (idx === 0) {
          tableHtml += '<thead><tr>'
          cells.forEach((cell) => {
            tableHtml += `<th>${cell}</th>`
          })
          tableHtml += '</tr></thead><tbody>'
        } else {
          tableHtml += '<tr>'
          cells.forEach((cell) => {
            tableHtml += `<td>${cell}</td>`
          })
          tableHtml += '</tr>'
        }
      })

      tableHtml += '</tbody></table></div>'
      return tableHtml
    }
  )

  // Unordered lists
  html = html.replace(
    /((?:^[\t ]*[-*]\s+.+\n?)+)/gm,
    (listBlock) => {
      const items = listBlock
        .trim()
        .split('\n')
        .map((line) => line.replace(/^[\t ]*[-*]\s+/, '').trim())
        .filter(Boolean)
      return '<ul class="md-ul">' + items.map((item) => `<li>${item}</li>`).join('') + '</ul>'
    }
  )

  // Ordered lists
  html = html.replace(
    /((?:^[\t ]*\d+\.\s+.+\n?)+)/gm,
    (listBlock) => {
      const items = listBlock
        .trim()
        .split('\n')
        .map((line) => line.replace(/^[\t ]*\d+\.\s+/, '').trim())
        .filter(Boolean)
      return '<ol class="md-ol">' + items.map((item) => `<li>${item}</li>`).join('') + '</ol>'
    }
  )

  // Blockquotes
  html = html.replace(
    /((?:^&gt;\s?.+\n?)+)/gm,
    (block) => {
      const text = block.replace(/^&gt;\s?/gm, '').trim()
      return `<blockquote class="md-blockquote">${text}</blockquote>`
    }
  )

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="md-link" target="_blank" rel="noopener">$1</a>')

  // Checkboxes
  html = html.replace(/\[x\]/gi, '<span class="md-checkbox checked">&#9745;</span>')
  html = html.replace(/\[ \]/g, '<span class="md-checkbox">&#9744;</span>')

  // Paragraphs: wrap remaining loose text lines
  html = html
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim()
      if (!trimmed) return ''
      // Don't wrap blocks that already have HTML tags
      if (
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<pre') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol') ||
        trimmed.startsWith('<table') ||
        trimmed.startsWith('<div') ||
        trimmed.startsWith('<blockquote') ||
        trimmed.startsWith('<hr')
      ) {
        return trimmed
      }
      return `<p class="md-p">${trimmed.replace(/\n/g, '<br />')}</p>`
    })
    .join('\n')

  return html
}

// ---------------------------------------------------------------
// Category config
// ---------------------------------------------------------------
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  analysis: { bg: '#EDE9FE', text: '#5B21B6' },
  architecture: { bg: '#DBEAFE', text: '#1D4ED8' },
  branding: { bg: '#FCE7F3', text: '#BE185D' },
  copy: { bg: '#FEF3C7', text: '#92400E' },
  design: { bg: '#CCFBF1', text: '#0F766E' },
  ideation: { bg: '#FFF7ED', text: '#C2410C' },
  intelligence: { bg: '#E0F2FE', text: '#0369A1' },
  logs: { bg: '#F3F4F6', text: '#6B7280' },
  planning: { bg: '#D1FAE5', text: '#047857' },
  prd: { bg: '#FEE2E2', text: '#B91C1C' },
  stories: { bg: '#EEF0FD', text: '#2D3561' },
  testing: { bg: '#FEF9C3', text: '#854D0E' },
}

const CATEGORY_ICONS: Record<string, string> = {
  analysis: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  architecture: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  branding: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01',
  copy: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  design: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  ideation: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  intelligence: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  logs: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  planning: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  prd: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  stories: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  testing: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
}

const CATEGORY_LABELS: Record<string, string> = {
  analysis: 'Analise',
  architecture: 'Arquitetura',
  branding: 'Branding',
  copy: 'Copy & Growth',
  design: 'Design',
  ideation: 'Ideacao',
  intelligence: 'Intelligence',
  logs: 'Logs',
  planning: 'Planejamento',
  prd: 'PRD',
  stories: 'Stories',
  testing: 'QA & Testing',
}

// ---------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

// ---------------------------------------------------------------
// Components
// ---------------------------------------------------------------
export function AdminDocsClient() {
  const [files, setFiles] = useState<DocFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<{ content: string; name: string; path: string } | null>(null)
  const [docLoading, setDocLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)

  // Fetch file list
  useEffect(() => {
    async function fetchDocs() {
      try {
        const res = await fetch('/api/v1/admin/docs')
        const json: DocsResponse = await res.json()
        if (json.success) {
          setFiles(json.files)
        } else {
          setError(json.error ?? 'Failed to load docs')
        }
      } catch {
        setError('Connection error')
      } finally {
        setLoading(false)
      }
    }
    fetchDocs()
  }, [])

  // Open doc in modal
  const openDoc = useCallback(async (filePath: string) => {
    setDocLoading(true)
    try {
      const res = await fetch(`/api/v1/admin/docs/content?path=${encodeURIComponent(filePath)}`)
      const json: DocContentResponse = await res.json()
      if (json.success) {
        setSelectedDoc({
          content: json.content,
          name: json.metadata.name,
          path: json.metadata.path,
        })
      }
    } catch {
      // silently fail
    } finally {
      setDocLoading(false)
    }
  }, [])

  // Close modal
  const closeModal = useCallback(() => {
    setSelectedDoc(null)
  }, [])

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeModal])

  // Group files by category
  const categories = files.reduce<Record<string, DocFile[]>>((acc, file) => {
    if (!acc[file.category]) acc[file.category] = []
    acc[file.category].push(file)
    return acc
  }, {})

  // Filter
  const filteredCategories = Object.entries(categories)
    .map(([cat, catFiles]) => {
      if (!filter) return [cat, catFiles] as [string, DocFile[]]
      const filtered = catFiles.filter(
        (f) =>
          f.name.toLowerCase().includes(filter.toLowerCase()) ||
          f.category.toLowerCase().includes(filter.toLowerCase())
      )
      return [cat, filtered] as [string, DocFile[]]
    })
    .filter(([, catFiles]) => catFiles.length > 0)

  return (
    <main
      id="main-content"
      className="min-h-screen"
      style={{ backgroundColor: 'var(--color-deep-indigo-dark)', minHeight: '100vh' }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-6 py-4 border-b"
        style={{
          backgroundColor: 'var(--color-deep-indigo)',
          borderColor: 'rgba(255,255,255,0.1)',
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ backgroundColor: 'var(--color-coral-hope)' }}
              aria-label="Voltar para pagina inicial"
            >
              <span
                className="text-sm font-bold text-white"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                R
              </span>
            </Link>
            <div>
              <h1
                className="text-xl font-bold text-white"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Documentacao do Projeto
              </h1>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {files.length} documentos em {Object.keys(categories).length} categorias
              </p>
            </div>
          </div>

          {/* Search filter */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar documentos..."
              className="bg-transparent text-sm text-white outline-none placeholder:text-white/40 w-48"
              style={{ fontFamily: 'var(--font-body)' }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading && (
          <div className="text-center py-20">
            <div
              className="inline-block w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-4"
              style={{ borderColor: 'var(--color-coral-hope)', borderTopColor: 'transparent' }}
            />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Carregando documentos...
            </p>
          </div>
        )}

        {error && (
          <div
            className="text-center py-20 rounded-xl"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px dashed rgba(255,255,255,0.15)',
            }}
          >
            <p className="text-sm mb-2" style={{ color: 'var(--color-coral-hope)' }}>
              {error}
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Verifique se o diretorio de docs esta acessivel no servidor.
            </p>
          </div>
        )}

        {!loading && !error && filteredCategories.length === 0 && (
          <div className="text-center py-20">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {filter ? 'Nenhum documento corresponde ao filtro.' : 'Nenhum documento encontrado.'}
            </p>
          </div>
        )}

        {/* Category sections */}
        <div className="space-y-8">
          {filteredCategories.map(([category, catFiles]) => {
            const colors = CATEGORY_COLORS[category] ?? { bg: '#F3F4F6', text: '#6B7280' }
            const iconPath = CATEGORY_ICONS[category]
            const label = CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1)

            return (
              <section key={category}>
                {/* Category header */}
                <div className="flex items-center gap-3 mb-4">
                  {iconPath && (
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: colors.bg }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={colors.text}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d={iconPath} />
                      </svg>
                    </div>
                  )}
                  <div>
                    <h2
                      className="text-base font-semibold text-white"
                      style={{ fontFamily: 'var(--font-heading)' }}
                    >
                      {label}
                    </h2>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {catFiles.length} {catFiles.length === 1 ? 'documento' : 'documentos'}
                    </p>
                  </div>
                </div>

                {/* Doc cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {catFiles.map((file) => (
                    <button
                      key={file.filePath}
                      onClick={() => openDoc(file.filePath)}
                      disabled={docLoading}
                      className="text-left p-4 rounded-xl transition-all duration-150 group"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Doc icon */}
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: colors.bg }}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke={colors.text}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                          </svg>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-semibold truncate mb-0.5"
                            style={{ color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-heading)' }}
                          >
                            {file.name}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="px-1.5 py-0.5 rounded text-xs font-medium"
                              style={{ backgroundColor: colors.bg, color: colors.text, fontSize: '0.65rem' }}
                            >
                              {label}
                            </span>
                            <span
                              className="text-xs"
                              style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}
                            >
                              {formatSize(file.size)}
                            </span>
                            <span
                              className="text-xs"
                              style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.65rem' }}
                            >
                              {formatDate(file.modifiedAt)}
                            </span>
                          </div>
                        </div>

                        {/* Arrow */}
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="rgba(255,255,255,0.2)"
                          strokeWidth="2"
                          className="flex-shrink-0 mt-1 transition-transform group-hover:translate-x-0.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      {/* Footer link back */}
      <div
        className="border-t px-6 py-4 text-center"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <Link
          href="/"
          className="text-xs transition-colors"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          Voltar para ReunIA
        </Link>
      </div>

      {/* ── DOCUMENT MODAL ──────────────────────────────────────── */}
      {selectedDoc && (
        <div
          className="fixed inset-0 z-50 flex items-stretch"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
          onClick={closeModal}
        >
          <div
            ref={modalRef}
            className="relative flex-1 max-w-4xl mx-auto my-4 md:my-8 flex flex-col rounded-xl overflow-hidden"
            style={{
              backgroundColor: '#1A1F3B',
              boxShadow: 'var(--shadow-modal)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <div className="min-w-0 flex-1">
                <h2
                  className="text-lg font-semibold text-white truncate"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  {selectedDoc.name}
                </h2>
                <p
                  className="text-xs mt-0.5 truncate"
                  style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}
                >
                  {selectedDoc.path}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="flex-shrink-0 ml-4 w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.05)' }}
                aria-label="Fechar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Modal content */}
            <div
              className="flex-1 overflow-y-auto px-6 py-6 md:px-8"
              style={{ scrollBehavior: 'smooth' }}
            >
              <div
                className="doc-content"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(selectedDoc.content) }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay for doc */}
      {docLoading && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--color-coral-hope)', borderTopColor: 'transparent' }}
          />
        </div>
      )}
    </main>
  )
}
