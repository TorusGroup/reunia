// =============================================================
// Unit tests for search ranking utilities
// =============================================================

import {
  URGENCY_BOOST,
  SOURCE_QUALITY_WEIGHT,
  buildOrderByClause,
  computeRelevanceScore,
  freshnessDecay,
  URGENCY_SQL_CASE,
  type SortOption,
} from '@/services/search/ranking'

describe('URGENCY_BOOST', () => {
  it('should have critical as highest boost', () => {
    expect(URGENCY_BOOST.critical).toBeGreaterThan(URGENCY_BOOST.high)
    expect(URGENCY_BOOST.high).toBeGreaterThan(URGENCY_BOOST.standard)
    expect(URGENCY_BOOST.standard).toBeGreaterThan(URGENCY_BOOST.low)
  })

  it('should have standard boost as 1.0 baseline', () => {
    expect(URGENCY_BOOST.standard).toBe(1.0)
  })
})

describe('SOURCE_QUALITY_WEIGHT', () => {
  it('should have ncmec as highest quality source', () => {
    expect(SOURCE_QUALITY_WEIGHT.ncmec).toBe(1.0)
    expect(SOURCE_QUALITY_WEIGHT.ncmec).toBeGreaterThanOrEqual(
      SOURCE_QUALITY_WEIGHT.interpol
    )
  })

  it('should have all weights between 0 and 1', () => {
    for (const [source, weight] of Object.entries(SOURCE_QUALITY_WEIGHT)) {
      expect(weight).toBeGreaterThanOrEqual(0)
      expect(weight).toBeLessThanOrEqual(1)
      expect(source).toBeTruthy()
    }
  })
})

describe('buildOrderByClause', () => {
  it('should include ts_rank when sort=relevance and hasTextQuery=true', () => {
    const clause = buildOrderByClause('relevance', true)
    expect(clause).toContain('rank DESC')
  })

  it('should fall back to quality sort when sort=relevance and hasTextQuery=false', () => {
    const clause = buildOrderByClause('relevance', false)
    expect(clause).toContain('data_quality DESC')
    expect(clause).not.toContain('rank DESC')
  })

  it('should sort by reported_at DESC when sort=date', () => {
    const clause = buildOrderByClause('date', false)
    expect(clause).toContain('reported_at DESC')
  })

  it('should sort by name when sort=name', () => {
    const clause = buildOrderByClause('name', false)
    expect(clause).toContain('name_sort ASC')
  })

  it('should sort by data_quality when sort=quality', () => {
    const clause = buildOrderByClause('quality', false)
    expect(clause).toContain('data_quality DESC')
  })

  it('should handle unknown sort option gracefully', () => {
    const clause = buildOrderByClause('unknown' as SortOption, false)
    expect(clause).toContain('ORDER BY')
  })
})

describe('URGENCY_SQL_CASE', () => {
  it('should contain CASE WHEN with all urgency values', () => {
    expect(URGENCY_SQL_CASE).toContain("'critical'")
    expect(URGENCY_SQL_CASE).toContain("'high'")
    expect(URGENCY_SQL_CASE).toContain("'standard'")
    expect(URGENCY_SQL_CASE).toContain("'low'")
    expect(URGENCY_SQL_CASE).toContain('urgency_order')
  })

  it('should assign critical = 1 (lowest number = highest priority)', () => {
    expect(URGENCY_SQL_CASE).toContain("'critical' THEN 1")
    expect(URGENCY_SQL_CASE).toContain("'high' THEN 2")
  })
})

describe('computeRelevanceScore', () => {
  it('should produce higher score for higher urgency', () => {
    const base = {
      id: '1',
      textRank: 0.5,
      dataQuality: 70,
      source: 'platform',
      lastSeenAt: null,
    }

    const critical = computeRelevanceScore({ ...base, urgency: 'critical' })
    const standard = computeRelevanceScore({ ...base, urgency: 'standard' })

    expect(critical).toBeGreaterThan(standard)
  })

  it('should produce higher score for higher data quality', () => {
    const base = {
      id: '1',
      textRank: 0.5,
      urgency: 'standard',
      source: 'platform',
      lastSeenAt: null,
    }

    const high = computeRelevanceScore({ ...base, dataQuality: 90 })
    const low = computeRelevanceScore({ ...base, dataQuality: 30 })

    expect(high).toBeGreaterThan(low)
  })

  it('should produce higher score for more reliable source', () => {
    const base = {
      id: '1',
      textRank: 0.5,
      dataQuality: 70,
      urgency: 'standard',
      lastSeenAt: null,
    }

    const ncmec = computeRelevanceScore({ ...base, source: 'ncmec' })
    const scraper = computeRelevanceScore({ ...base, source: 'scraper' })

    expect(ncmec).toBeGreaterThan(scraper)
  })

  it('should handle unknown source gracefully (use fallback weight)', () => {
    const score = computeRelevanceScore({
      id: '1',
      textRank: 0.5,
      dataQuality: 70,
      urgency: 'standard',
      source: 'unknown_source',
      lastSeenAt: null,
    })

    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(10)
  })

  it('should return a positive number', () => {
    const score = computeRelevanceScore({
      id: '1',
      textRank: 0.0,
      dataQuality: 0,
      urgency: 'low',
      source: 'other',
      lastSeenAt: null,
    })

    expect(score).toBeGreaterThanOrEqual(0)
  })
})

describe('freshnessDecay', () => {
  it('should return 1.0 for a very recent case (< 7 days)', () => {
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    expect(freshnessDecay(recentDate)).toBe(1.0)
  })

  it('should return 0.9 for null date', () => {
    expect(freshnessDecay(null)).toBe(0.9)
  })

  it('should return 0.9 for undefined date', () => {
    expect(freshnessDecay(undefined)).toBe(0.9)
  })

  it('should return 0.97 for a case 2 weeks old', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    expect(freshnessDecay(twoWeeksAgo)).toBe(0.97)
  })

  it('should return 0.85 for a case over a year old', () => {
    const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000)
    expect(freshnessDecay(twoYearsAgo)).toBe(0.85)
  })

  it('should be monotonically decreasing with age', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000)

    const values = [sevenDaysAgo, thirtyDaysAgo, ninetyDaysAgo, oneYearAgo, twoYearsAgo].map(
      freshnessDecay
    )

    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1]!)
    }
  })
})
