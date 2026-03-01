import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

// =============================================================
// GET /api/v1/admin/docs/content?path=analysis/data-sources-research.md
// Reads a specific markdown file and returns its content
// =============================================================

function getDocsDir(): string {
  const candidates = [
    path.resolve(process.cwd(), '..', 'aios-core', 'projects', 'missing-children', 'docs'),
    path.join('C:', 'Users', 'Matheus', 'clawd', 'aios-core', 'projects', 'missing-children', 'docs'),
    path.resolve(process.cwd(), 'docs'),
  ]

  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir
  }

  return candidates[0]
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('path')

  if (!filePath) {
    return NextResponse.json(
      { success: false, error: 'Missing path parameter' },
      { status: 400 }
    )
  }

  // Security: Prevent path traversal
  const normalized = path.normalize(filePath).replace(/\\/g, '/')
  if (normalized.includes('..') || normalized.startsWith('/') || normalized.includes(':')) {
    return NextResponse.json(
      { success: false, error: 'Invalid path' },
      { status: 403 }
    )
  }

  try {
    const docsDir = getDocsDir()
    const fullPath = path.join(docsDir, normalized)

    // Double check the resolved path is within docsDir
    const resolvedPath = path.resolve(fullPath)
    const resolvedDocsDir = path.resolve(docsDir)
    if (!resolvedPath.startsWith(resolvedDocsDir)) {
      return NextResponse.json(
        { success: false, error: 'Path traversal not allowed' },
        { status: 403 }
      )
    }

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      )
    }

    const stats = fs.statSync(fullPath)
    const content = fs.readFileSync(fullPath, 'utf-8')
    const name = path.basename(fullPath, '.md')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())

    return NextResponse.json({
      success: true,
      content,
      metadata: {
        name,
        path: normalized,
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
      },
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: `Failed to read file: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 500 }
    )
  }
}
