// =============================================================
// Deduplicator module unit tests (Q-01)
// Tests: exact match, fuzzy match, cross-source dedup, thresholds
// =============================================================

import { findExactMatch, findFuzzyMatch } from '@/services/ingestion/deduplicator'
import type { NormalizedCase } from '@/services/ingestion/base-adapter'
import type { CaseSource } from '@prisma/client'

// ---------------------------------------------------------------
// Mock @/lib/db (Prisma client)
// ---------------------------------------------------------------
const mockCaseFindFirst = jest.fn()
const mockPersonFindMany = jest.fn()

jest.mock('@/lib/db', () => ({
  db: {
    case: {
      findFirst: (...args: unknown[]) => mockCaseFindFirst(...args),
    },
    person: {
      findMany: (...args: unknown[]) => mockPersonFindMany(...args),
    },
  },
}))

// Mock @/lib/logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}))

// ---------------------------------------------------------------
// Helper: build a minimal NormalizedCase
// ---------------------------------------------------------------
function buildRecord(overrides: Partial<NormalizedCase> = {}): NormalizedCase {
  return {
    externalId: 'ext-001',
    source: 'FBI' as CaseSource,
    firstName: 'Maria',
    lastName: 'Santos',
    nameNormalized: 'maria santos',
    dateOfBirth: new Date('2010-05-15'),
    missingDate: new Date('2024-01-10'),
    lastSeenLocation: null,
    lastSeenLat: null,
    lastSeenLng: null,
    lastSeenCountry: null,
    description: null,
    age: 14,
    ageRange: null,
    gender: 'female',
    race: null,
    heightCm: null,
    weightKg: null,
    photoUrls: [],
    status: 'missing',
    sourceUrl: null,
    rawData: {},
    ...overrides,
  } as NormalizedCase
}

describe('deduplicator', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ---------------------------------------------------------------
  // Exact match (same source + same externalId)
  // ---------------------------------------------------------------
  describe('findExactMatch', () => {
    it('should find existing case by source + externalId', async () => {
      mockCaseFindFirst.mockResolvedValue({
        id: 'case-abc',
        persons: [{ id: 'person-xyz' }],
      })

      const result = await findExactMatch('ext-001', 'FBI' as CaseSource)

      expect(result).toEqual({
        caseId: 'case-abc',
        personId: 'person-xyz',
      })
      expect(mockCaseFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            source: 'FBI',
            sourceId: 'ext-001',
          },
        })
      )
    })

    it('should return null when no matching case exists', async () => {
      mockCaseFindFirst.mockResolvedValue(null)

      const result = await findExactMatch('nonexistent', 'FBI' as CaseSource)

      expect(result).toBeNull()
    })

    it('should return null when case exists but has no person', async () => {
      mockCaseFindFirst.mockResolvedValue({
        id: 'case-abc',
        persons: [],
      })

      const result = await findExactMatch('ext-001', 'FBI' as CaseSource)

      expect(result).toBeNull()
    })
  })

  // ---------------------------------------------------------------
  // Fuzzy match (cross-source deduplication)
  // ---------------------------------------------------------------
  describe('findFuzzyMatch', () => {
    it('should detect cross-source duplicate with high name similarity', async () => {
      const record = buildRecord({
        source: 'FBI' as CaseSource,
        firstName: 'Maria',
        lastName: 'Santos',
        dateOfBirth: new Date('2010-05-15'),
        gender: 'female',
      })

      mockPersonFindMany.mockResolvedValue([
        {
          id: 'person-existing',
          firstName: 'Maria',
          lastName: 'Santos',
          dateOfBirth: new Date('2010-05-15'),
          gender: 'female',
          nameNormalized: 'maria santos',
          case: {
            id: 'case-existing',
            source: 'NCMEC',
            status: 'active',
          },
        },
      ])

      const result = await findFuzzyMatch(record)

      expect(result.isDuplicate).toBe(true)
      expect(result.action).toBe('update')
      expect(result.existingCaseId).toBe('case-existing')
      expect(result.existingPersonId).toBe('person-existing')
      expect(result.score).toBeGreaterThanOrEqual(0.85)
    })

    it('should NOT flag as duplicate when name similarity is below threshold', async () => {
      const record = buildRecord({
        firstName: 'Maria',
        lastName: 'Santos',
      })

      mockPersonFindMany.mockResolvedValue([
        {
          id: 'person-other',
          firstName: 'Carlos',
          lastName: 'Oliveira',
          dateOfBirth: null,
          gender: 'male',
          nameNormalized: 'carlos oliveira',
          case: {
            id: 'case-other',
            source: 'NCMEC',
            status: 'active',
          },
        },
      ])

      const result = await findFuzzyMatch(record)

      expect(result.isDuplicate).toBe(false)
      expect(result.action).toBe('create')
      expect(result.score).toBeLessThan(0.85)
    })

    it('should return create action when no candidates found', async () => {
      const record = buildRecord()
      mockPersonFindMany.mockResolvedValue([])

      const result = await findFuzzyMatch(record)

      expect(result.isDuplicate).toBe(false)
      expect(result.action).toBe('create')
      expect(result.score).toBe(0)
      expect(result.reason).toContain('No candidates found')
    })

    it('should return create action when name is too short for dedup', async () => {
      const record = buildRecord({
        firstName: 'Jo',
        lastName: '',
        nameNormalized: 'jo',
      })

      const result = await findFuzzyMatch(record)

      expect(result.isDuplicate).toBe(false)
      expect(result.action).toBe('create')
      expect(result.reason).toContain('Insufficient name data')
    })

    it('should boost score when DOB exactly matches', async () => {
      const dob = new Date('2010-05-15')
      const record = buildRecord({
        firstName: 'Maria',
        lastName: 'Santoz', // slightly different spelling
        dateOfBirth: dob,
        gender: 'female',
      })

      // Return candidate with exact same DOB and similar name
      mockPersonFindMany.mockResolvedValue([
        {
          id: 'person-close',
          firstName: 'Maria',
          lastName: 'Santos',
          dateOfBirth: dob,
          gender: 'female',
          nameNormalized: 'maria santos',
          case: {
            id: 'case-close',
            source: 'NCMEC',
            status: 'active',
          },
        },
      ])

      const result = await findFuzzyMatch(record)

      // Score should be boosted by DOB match (+0.10) and gender match (+0.05)
      expect(result.score).toBeGreaterThan(0.85)
    })

    it('should handle DB errors gracefully (default to create)', async () => {
      const record = buildRecord()
      mockPersonFindMany.mockRejectedValue(new Error('Connection refused'))

      const result = await findFuzzyMatch(record)

      expect(result.isDuplicate).toBe(false)
      expect(result.action).toBe('create')
      expect(result.reason).toContain('Deduplication error')
      expect(result.reason).toContain('Connection refused')
    })
  })
})
