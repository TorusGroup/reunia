import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { buildSearchFilters, buildAppliedFilters, type SearchParams, type AppliedFilters } from '@/services/search/filters'
import { buildOrderByClause, URGENCY_SQL_CASE } from '@/services/search/ranking'
import { getCachedSearch, setCachedSearch, type CachedSearchResult } from '@/services/search/cache'

// =============================================================
// Unified Search Engine (E3-S01, E3-S02, E3-S03)
//
// Implementation strategy:
// 1. Full-text search via PostgreSQL tsvector + GIN index
//    - to_tsvector('portuguese', coalesce(p.name_normalized, ''))
//    - to_tsvector('english', coalesce(p.name_normalized, ''))
//    - Combined with OR to support both dictionaries
//    - ts_rank_cd for relevance scoring
//
// 2. Fuzzy name search via pg_trgm
//    - similarity(p.name_normalized, normalized_query) > 0.3
//    - Catches typos in names
//
// 3. Geo search via PostGIS
//    - ST_DWithin(c.last_seen_geo, ST_MakePoint(lng, lat)::geography, radius_m)
//    - Only applied when lat+lng present
//
// 4. Filters via WHERE clauses (AND logic)
//
// 5. Results include distance when geo filter active
// =============================================================

// ---------------------------------------------------------------
// Result type returned by the search engine
// ---------------------------------------------------------------

export interface PersonSearchResult {
  id: string
  firstName: string | null
  lastName: string | null
  nickname: string | null
  approximateAge: number | null
  dateOfBirth: Date | null
  gender: string | null
  thumbnailUrl: string | null
  storageUrl: string | null
}

export interface SearchEngineResult {
  id: string
  caseNumber: string
  caseType: string
  status: string
  urgency: string
  source: string
  reportedAt: Date
  lastSeenAt: Date | null
  lastSeenLocation: string | null
  lastSeenCountry: string | null
  dataQuality: number
  distanceKm: number | null    // populated only when geo filter active
  textRank: number             // 0-1, ts_rank_cd value
  persons: PersonSearchResult[]
}

export interface SearchEngineResponse {
  results: SearchEngineResult[]
  total: number
  page: number
  limit: number
  totalPages: number
  took: number          // milliseconds
  fromCache: boolean
  filters: AppliedFilters
}

// ---------------------------------------------------------------
// Input sanitization — prevent SQL injection in raw queries
// ---------------------------------------------------------------

function sanitizeForTsQuery(input: string): string {
  // Remove characters that could break tsquery
  // Allow letters, numbers, spaces, hyphens, apostrophes
  return input
    .replace(/[^\w\s\-'áàâãéèêíìîóòôõúùûçñÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇÑ]/g, ' ')
    .trim()
    .slice(0, 100)
}

function sanitizeForTrigram(input: string): string {
  // For trigram similarity, just prevent SQL injection via parameterized query
  // (we always use $N placeholders)
  return input.trim().slice(0, 100)
}

function buildTsQuery(raw: string): string {
  // Convert "john doe" -> "john:* & doe:*"
  // Prefix matching supports partial words
  const words = sanitizeForTsQuery(raw)
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2)

  if (words.length === 0) return ''

  return words.map((w) => `${w}:*`).join(' & ')
}

// ---------------------------------------------------------------
// Core text search query (raw SQL with pgvector + tsvector)
// ---------------------------------------------------------------

export async function executeTextSearch(
  params: SearchParams
): Promise<{ results: SearchEngineResult[]; total: number }> {
  const filters = buildSearchFilters(params)
  const { caseWhere, personWhere, hasGeoFilter, geoParams } = filters

  const offset = (params.page - 1) * params.limit
  const limit = params.limit

  // Build dynamic WHERE conditions as strings (for raw SQL)
  // Using positional params to prevent SQL injection
  const sqlParams: unknown[] = []
  const caseConditions: string[] = [
    `c.anonymized_at IS NULL`,
    `c.deletion_requested = FALSE`,
  ]
  const personConditions: string[] = [
    `p.case_id = c.id`,
    `p.role = 'missing_child'`,
  ]

  // --- Case-level filters ---

  if (caseWhere.status) {
    sqlParams.push(caseWhere.status)
    caseConditions.push(`c.status = $${sqlParams.length}::case_status`)
  }

  if (caseWhere.caseType) {
    sqlParams.push(caseWhere.caseType)
    caseConditions.push(`c.case_type = $${sqlParams.length}::case_type`)
  }

  if (caseWhere.urgency) {
    sqlParams.push(caseWhere.urgency)
    caseConditions.push(`c.urgency = $${sqlParams.length}::case_urgency`)
  }

  if (caseWhere.source) {
    // Multi-select: source IN (...)
    sqlParams.push(caseWhere.source.in)
    caseConditions.push(`c.source = ANY($${sqlParams.length}::case_source[])`)
  }

  if (caseWhere.lastSeenCountry) {
    sqlParams.push(caseWhere.lastSeenCountry)
    caseConditions.push(`c.last_seen_country = $${sqlParams.length}`)
  }

  if (caseWhere.lastSeenLocation) {
    // Fallback ILIKE for location text (tsvector handles name search)
    sqlParams.push(`%${caseWhere.lastSeenLocation.contains}%`)
    caseConditions.push(`c.last_seen_location ILIKE $${sqlParams.length}`)
  }

  if (caseWhere.reportedAt?.gte) {
    sqlParams.push(caseWhere.reportedAt.gte)
    caseConditions.push(`c.reported_at >= $${sqlParams.length}`)
  }

  if (caseWhere.reportedAt?.lte) {
    sqlParams.push(caseWhere.reportedAt.lte)
    caseConditions.push(`c.reported_at <= $${sqlParams.length}`)
  }

  // --- Person-level filters ---

  if (personWhere.gender) {
    sqlParams.push(personWhere.gender)
    personConditions.push(`p.gender = $${sqlParams.length}::person_gender`)
  }

  if (personWhere.approximateAge?.gte !== undefined) {
    sqlParams.push(personWhere.approximateAge.gte)
    personConditions.push(`p.approximate_age >= $${sqlParams.length}`)
  }

  if (personWhere.approximateAge?.lte !== undefined) {
    sqlParams.push(personWhere.approximateAge.lte)
    personConditions.push(`p.approximate_age <= $${sqlParams.length}`)
  }

  if (personWhere.hairColor) {
    sqlParams.push(`%${personWhere.hairColor.contains}%`)
    personConditions.push(`p.hair_color ILIKE $${sqlParams.length}`)
  }

  if (personWhere.eyeColor) {
    sqlParams.push(`%${personWhere.eyeColor.contains}%`)
    personConditions.push(`p.eye_color ILIKE $${sqlParams.length}`)
  }

  // --- Full-text / trigram search ---
  let rankExpression = '0.0::float4 AS rank'
  let nameSortExpression = `COALESCE(p.name_normalized, LOWER(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), '') AS name_sort`
  let textSearchCondition = ''

  if (params.q && params.q.length > 0) {
    const rawQuery = params.q.trim()
    const normalizedQuery = sanitizeForTrigram(rawQuery.toLowerCase())
    const tsQuery = buildTsQuery(rawQuery)

    if (tsQuery) {
      // Register ts query param (stored as text, cast to tsquery inline)
      sqlParams.push(tsQuery)
      const tsQueryParam = `to_tsquery('portuguese', $${sqlParams.length})`
      const tsQueryParamEn = `to_tsquery('english', $${sqlParams.length})`

      // Register normalized query for trigram
      sqlParams.push(normalizedQuery)
      const trigramParam = `$${sqlParams.length}`

      // Build a synthetic name column from first_name + last_name as fallback
      // when name_normalized is NULL (GENERATED column migration not applied)
      const nameExpr = `COALESCE(p.name_normalized, LOWER(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), '')`

      // Portuguese + English dictionary combination
      // ts_rank_cd with document length normalization
      rankExpression = `
        GREATEST(
          COALESCE(ts_rank_cd(
            to_tsvector('simple', ${nameExpr}),
            ${tsQueryParam}
          ), 0),
          COALESCE(ts_rank_cd(
            to_tsvector('english', ${nameExpr}),
            ${tsQueryParamEn}
          ), 0),
          COALESCE(similarity(${nameExpr}, ${trigramParam}), 0)
        ) AS rank
      `

      // Full-text OR trigram match condition
      // Uses ILIKE on first_name/last_name as a robust fallback
      textSearchCondition = `
        AND (
          (to_tsvector('simple', ${nameExpr}) @@ ${tsQueryParam})
          OR (to_tsvector('english', ${nameExpr}) @@ ${tsQueryParamEn})
          OR (similarity(${nameExpr}, ${trigramParam}) > 0.3)
          OR (p.first_name ILIKE '%' || ${trigramParam} || '%')
          OR (p.last_name ILIKE '%' || ${trigramParam} || '%')
          OR (c.last_seen_location ILIKE '%' || ${trigramParam} || '%')
          OR (c.circumstances ILIKE '%' || ${trigramParam} || '%')
        )
      `
    }

    nameSortExpression = `COALESCE(p.name_normalized, LOWER(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), '') AS name_sort`
  } else {
    nameSortExpression = `COALESCE(p.name_normalized, LOWER(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), '') AS name_sort`
  }

  // --- Geo filter ---
  // P-02: PostGIS is not enabled in the current deployment.
  // Geo queries (ST_DWithin, ST_Distance, ST_MakePoint) are guarded
  // behind a feature flag. When PostGIS is enabled (post-MVP),
  // set POSTGIS_ENABLED=true in env to activate geo-based search.
  let geoCondition = ''
  let distanceExpression = 'NULL::float8 AS distance_km'

  const postgisEnabled = process.env.POSTGIS_ENABLED === 'true'

  if (hasGeoFilter && geoParams && postgisEnabled) {
    sqlParams.push(geoParams.lng)
    sqlParams.push(geoParams.lat)
    sqlParams.push(geoParams.radiusMeters)
    const lngParam = `$${sqlParams.length - 2}`
    const latParam = `$${sqlParams.length - 1}`
    const radiusParam = `$${sqlParams.length}`

    geoCondition = `
      AND c.last_seen_geo IS NOT NULL
      AND ST_DWithin(
        c.last_seen_geo::geography,
        ST_MakePoint(${lngParam}, ${latParam})::geography,
        ${radiusParam}
      )
    `

    distanceExpression = `
      ST_Distance(
        c.last_seen_geo::geography,
        ST_MakePoint(${lngParam}, ${latParam})::geography
      ) / 1000.0 AS distance_km
    `
  } else if (hasGeoFilter && geoParams && !postgisEnabled) {
    logger.warn(
      { lat: geoParams.lat, lng: geoParams.lng },
      'Geo filter requested but PostGIS is not enabled (POSTGIS_ENABLED != true). Skipping geo-based filtering.'
    )
  }

  // --- Order by ---
  const orderBy = buildOrderByClause(params.sort, Boolean(params.q))

  // --- Final count query ---
  const countQuery = `
    SELECT COUNT(DISTINCT c.id) AS total
    FROM cases c
    INNER JOIN persons p ON ${personConditions.join(' AND ')}
    WHERE ${caseConditions.join(' AND ')}
    ${textSearchCondition}
    ${geoCondition}
  `

  // --- Final results query ---
  const resultsQuery = `
    WITH ranked AS (
      SELECT DISTINCT ON (c.id)
        c.id,
        c.case_number,
        c.case_type,
        c.status,
        c.urgency,
        c.source,
        c.reported_at,
        c.last_seen_at,
        c.last_seen_location,
        c.last_seen_country,
        c.data_quality,
        p.id AS person_id,
        p.first_name,
        p.last_name,
        p.nickname,
        p.approximate_age,
        p.date_of_birth,
        p.gender,
        ${rankExpression},
        ${distanceExpression},
        ${nameSortExpression},
        ${URGENCY_SQL_CASE}
      FROM cases c
      INNER JOIN persons p ON ${personConditions.join(' AND ')}
      WHERE ${caseConditions.join(' AND ')}
      ${textSearchCondition}
      ${geoCondition}
      ORDER BY c.id, rank DESC
    )
    SELECT
      r.*,
      i.thumbnail_url,
      i.storage_url
    FROM ranked r
    LEFT JOIN LATERAL (
      SELECT thumbnail_url, storage_url
      FROM images
      WHERE person_id = r.person_id AND is_primary = TRUE
      LIMIT 1
    ) i ON TRUE
    ${orderBy}
    LIMIT ${limit} OFFSET ${offset}
  `

  // Execute both queries in parallel
  const [countResult, rowsResult] = await Promise.all([
    db.$queryRawUnsafe<[{ total: bigint }]>(countQuery, ...sqlParams),
    db.$queryRawUnsafe<
      Array<{
        id: string
        case_number: string
        case_type: string
        status: string
        urgency: string
        source: string
        reported_at: Date
        last_seen_at: Date | null
        last_seen_location: string | null
        last_seen_country: string | null
        data_quality: number
        person_id: string
        first_name: string | null
        last_name: string | null
        nickname: string | null
        approximate_age: number | null
        date_of_birth: Date | null
        gender: string | null
        rank: number
        distance_km: number | null
        thumbnail_url: string | null
        storage_url: string | null
      }>
    >(resultsQuery, ...sqlParams),
  ])

  const total = Number(countResult[0]?.total ?? 0)

  const results: SearchEngineResult[] = rowsResult.map((row) => ({
    id: row.id,
    caseNumber: row.case_number,
    caseType: row.case_type,
    status: row.status,
    urgency: row.urgency,
    source: row.source,
    reportedAt: row.reported_at,
    lastSeenAt: row.last_seen_at,
    lastSeenLocation: row.last_seen_location,
    lastSeenCountry: row.last_seen_country,
    dataQuality: row.data_quality,
    distanceKm: row.distance_km !== null ? Math.round(row.distance_km * 10) / 10 : null,
    textRank: Number(row.rank ?? 0),
    persons: [
      {
        id: row.person_id,
        firstName: row.first_name,
        lastName: row.last_name,
        nickname: row.nickname,
        approximateAge: row.approximate_age,
        dateOfBirth: row.date_of_birth,
        gender: row.gender,
        thumbnailUrl: row.thumbnail_url,
        storageUrl: row.storage_url,
      },
    ],
  }))

  return { results, total }
}

// ---------------------------------------------------------------
// Public search function — with caching
// ---------------------------------------------------------------

export async function search(params: SearchParams): Promise<SearchEngineResponse> {
  const startMs = Date.now()

  // Try cache first
  const cached = await getCachedSearch(params)
  if (cached) {
    return {
      results: cached.results,
      total: cached.total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(cached.total / params.limit),
      took: Date.now() - startMs,
      fromCache: true,
      filters: buildAppliedFilters(params),
    }
  }

  // Execute live search
  const { results, total } = await executeTextSearch(params)

  // Cache the results (async — don't await)
  setCachedSearch(params, { results, total }).catch((err) =>
    logger.warn({ err }, 'Failed to cache search results')
  )

  return {
    results,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
    took: Date.now() - startMs,
    fromCache: false,
    filters: buildAppliedFilters(params),
  }
}

// ---------------------------------------------------------------
// Autocomplete suggest function (trigram + prefix on name_normalized)
// ---------------------------------------------------------------

export interface SuggestResult {
  name: string
  caseId: string
  similarity: number
}

export async function suggestNames(query: string): Promise<SuggestResult[]> {
  if (!query || query.trim().length < 2) return []

  const normalized = query.toLowerCase().trim().slice(0, 50)

  // pg_trgm word_similarity for prefix-style autocomplete
  // + tsvector prefix match for fast GIN index usage
  const tsQuery = buildTsQuery(query)

  if (!tsQuery) return []

  // Build a fallback name expression when name_normalized is NULL
  // (GENERATED column migration may not have been applied)
  const rows = await db.$queryRaw<
    Array<{
      name: string
      case_id: string
      sim: number
    }>
  >`
    SELECT DISTINCT
      COALESCE(p.first_name || ' ' || COALESCE(p.last_name, ''), p.first_name, p.last_name, 'Unknown') AS name,
      c.id AS case_id,
      COALESCE(
        word_similarity(
          COALESCE(p.name_normalized, LOWER(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, ''))),
          ${normalized}
        ),
        0
      ) AS sim
    FROM persons p
    INNER JOIN cases c ON c.id = p.case_id
    WHERE
      p.role = 'missing_child'
      AND c.status = 'active'
      AND c.anonymized_at IS NULL
      AND (p.first_name IS NOT NULL OR p.last_name IS NOT NULL)
      AND (
        word_similarity(
          COALESCE(p.name_normalized, LOWER(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, ''))),
          ${normalized}
        ) > 0.25
        OR p.first_name ILIKE '%' || ${normalized} || '%'
        OR p.last_name ILIKE '%' || ${normalized} || '%'
        OR to_tsvector('simple',
          COALESCE(p.name_normalized, LOWER(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')))
        ) @@ to_tsquery('simple', ${tsQuery})
      )
    ORDER BY sim DESC, name ASC
    LIMIT 8
  `

  return rows.map((r) => ({
    name: r.name.trim(),
    caseId: r.case_id,
    similarity: Number(r.sim ?? 0),
  }))
}
