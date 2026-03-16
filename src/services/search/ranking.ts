// =============================================================
// Search Ranking & Relevance Scoring (E3-S01)
// Combines PostgreSQL ts_rank_cd + data quality + urgency
// =============================================================

// ---------------------------------------------------------------
// Urgency boost multipliers
// Higher urgency = pushed to top of results
// ---------------------------------------------------------------
export const URGENCY_BOOST: Record<string, number> = {
  critical: 2.0,
  high: 1.5,
  standard: 1.0,
  low: 0.7,
}

// Source reliability weights (mirrors data quality scoring in E2-S08)
export const SOURCE_QUALITY_WEIGHT: Record<string, number> = {
  ncmec: 1.0,
  interpol: 0.95,
  fbi: 0.9,
  amber: 0.85,
  opensanctions: 0.75,
  cnpd: 0.7,
  disque100: 0.6,
  platform: 0.8,
  gdelt: 0.5,
  namus: 0.8,
  scraper: 0.4,
  other: 0.4,
}

// ---------------------------------------------------------------
// SQL ORDER BY clause builder
// Used in raw queries where we have ts_rank_cd available
// ---------------------------------------------------------------

export type SortOption = 'relevance' | 'date' | 'name' | 'quality'

export function buildOrderByClause(sort: SortOption, hasTextQuery: boolean): string {
  switch (sort) {
    case 'relevance':
      if (hasTextQuery) {
        // ts_rank_cd is injected by the search engine query
        return 'ORDER BY rank DESC, c.data_quality DESC, urgency_order ASC, c.reported_at DESC'
      }
      // No text query: fall through to quality
      return 'ORDER BY c.data_quality DESC, urgency_order ASC, c.reported_at DESC'

    case 'date':
      return 'ORDER BY c.reported_at DESC, c.data_quality DESC'

    case 'name':
      // Sort by primary person name ascending
      return 'ORDER BY name_sort ASC, c.reported_at DESC'

    case 'quality':
      return 'ORDER BY c.data_quality DESC, urgency_order ASC, c.reported_at DESC'

    default:
      return 'ORDER BY c.data_quality DESC, c.reported_at DESC'
  }
}

// ---------------------------------------------------------------
// Urgency numeric mapping for SQL ORDER BY
// CASE WHEN c.urgency = 'critical' THEN 1 ... END AS urgency_order
// ---------------------------------------------------------------
export const URGENCY_SQL_CASE = `
  CASE c.urgency
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'standard' THEN 3
    WHEN 'low' THEN 4
    ELSE 5
  END AS urgency_order
`

// ---------------------------------------------------------------
// Result scoring for in-memory re-ranking (post DB sort)
// Used when we need to merge cached + live results
// ---------------------------------------------------------------
export interface ScoredResult {
  id: string
  textRank: number      // ts_rank_cd value (0-1)
  dataQuality: number   // 0-100
  urgency: string
  source: string
  lastSeenAt?: Date | null
  computedScore: number
}

export function computeRelevanceScore(result: ScoredResult): number {
  const urgencyMultiplier = URGENCY_BOOST[result.urgency] ?? 1.0
  const sourceWeight = SOURCE_QUALITY_WEIGHT[result.source] ?? 0.5

  // Weighted score:
  // - Text rank (normalized 0-1): 40% weight
  // - Data quality (normalized 0-1): 35% weight
  // - Source reliability: 15% weight
  // - Urgency boost applied as multiplier
  const baseScore =
    result.textRank * 0.4 +
    (result.dataQuality / 100) * 0.35 +
    sourceWeight * 0.15

  return baseScore * urgencyMultiplier
}

// ---------------------------------------------------------------
// Freshness decay — applies penalty for older cases
// Older unresolved cases get deprioritized slightly
// ---------------------------------------------------------------
export function freshnessDecay(lastSeenAt: Date | null | undefined): number {
  if (!lastSeenAt) return 0.9 // Unknown date — mild penalty

  const daysSince = (Date.now() - lastSeenAt.getTime()) / (1000 * 60 * 60 * 24)

  if (daysSince < 7) return 1.0    // Fresh: no decay
  if (daysSince < 30) return 0.97  // 1-4 weeks: minimal decay
  if (daysSince < 90) return 0.94  // 1-3 months
  if (daysSince < 365) return 0.9  // 3-12 months
  return 0.85                       // Over a year
}
