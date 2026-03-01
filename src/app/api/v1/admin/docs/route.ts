import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

// =============================================================
// GET /api/v1/admin/docs
// Lists all .md files in the project docs directory
// Returns: { files: [{ path, name, category, size, modifiedAt }] }
// =============================================================

interface DocFile {
  filePath: string
  name: string
  category: string
  size: number
  modifiedAt: string
}

// Category display names
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

function getDocsDir(): string {
  // Try multiple possible locations for the docs
  const candidates = [
    // Same machine, aios-core repo (primary)
    path.resolve(process.cwd(), '..', 'aios-core', 'projects', 'missing-children', 'docs'),
    // Alternative: directly under C:\Users\Matheus\clawd\aios-core
    path.join('C:', 'Users', 'Matheus', 'clawd', 'aios-core', 'projects', 'missing-children', 'docs'),
    // Fallback: within the reunia-deploy repo itself
    path.resolve(process.cwd(), 'docs'),
  ]

  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir
  }

  return candidates[0] // Default to primary even if missing
}

function scanDirectory(dir: string, baseDir: string): DocFile[] {
  const files: DocFile[] = []

  if (!fs.existsSync(dir)) return files

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...scanDirectory(fullPath, baseDir))
    } else if (entry.name.endsWith('.md')) {
      const stats = fs.statSync(fullPath)
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/')
      const category = relativePath.split('/')[0] || 'other'

      // Human-readable name from filename
      const name = entry.name
        .replace(/\.md$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())

      files.push({
        filePath: relativePath,
        name,
        category,
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
      })
    }
  }

  return files
}

export async function GET(): Promise<NextResponse> {
  try {
    const docsDir = getDocsDir()
    const files = scanDirectory(docsDir, docsDir)

    // Sort by category then by name
    files.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category)
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({
      success: true,
      docsDir,
      categoryLabels: CATEGORY_LABELS,
      files,
      total: files.length,
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: `Failed to scan docs: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 500 }
    )
  }
}
