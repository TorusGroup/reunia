import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// =============================================================
// GET /api/v1/admin/cases-with-images
// Returns cases that have at least one image, including the
// image ID needed for face embedding generation.
// Auth: x-admin-key header required
// =============================================================

function checkAdminKey(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key') ?? ''
  const expectedKey = process.env.ADMIN_INGESTION_KEY ?? 'reunia-admin'
  return adminKey === expectedKey
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!checkAdminKey(request)) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin key required' } },
      { status: 401 }
    )
  }

  try {
    const images = await db.image.findMany({
      where: {
        // Include all images regardless of hasFace status
        // We'll let face-api.js determine if a face exists
        storageUrl: { not: '' },
      },
      select: {
        id: true,
        storageUrl: true,
        thumbnailUrl: true,
        personId: true,
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            caseId: true,
            case: {
              select: {
                id: true,
                caseNumber: true,
                status: true,
              },
            },
            faceEmbeddings: {
              where: { isSearchable: true, embedding: { not: null } },
              select: { id: true, imageId: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    const result = images.map((img) => ({
      imageId: img.id,
      personId: img.personId,
      caseId: img.person.case.id,
      caseNumber: img.person.case.caseNumber,
      caseStatus: img.person.case.status,
      firstName: img.person.firstName,
      lastName: img.person.lastName,
      photoUrl: img.thumbnailUrl ?? img.storageUrl,
      hasEmbedding: img.person.faceEmbeddings.length > 0,
    }))

    return NextResponse.json({
      success: true,
      data: result,
      meta: { total: result.length },
    })
  } catch (err) {
    logger.error({ err }, 'GET /api/v1/admin/cases-with-images: error')
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch cases with images' },
      },
      { status: 500 }
    )
  }
}
