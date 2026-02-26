// =============================================================
// Case, Person, Image Types
// =============================================================

export type CaseStatus =
  | 'draft'
  | 'pending_review'
  | 'active'
  | 'resolved'
  | 'closed'
  | 'archived'

export type CaseUrgency = 'critical' | 'high' | 'standard' | 'low'

export type CaseType =
  | 'missing'
  | 'abduction_family'
  | 'abduction_nonfamily'
  | 'runaway'
  | 'lost'
  | 'trafficking_suspected'
  | 'unidentified'
  | 'other'

export type CaseSource =
  | 'platform'
  | 'fbi'
  | 'interpol'
  | 'ncmec'
  | 'amber'
  | 'opensanctions'
  | 'cnpd'
  | 'disque100'
  | 'gdelt'
  | 'namus'
  | 'scraper'
  | 'other'

export type PersonRole = 'missing_child' | 'companion' | 'suspect' | 'witness'

export type PersonGender = 'male' | 'female' | 'other' | 'unknown'

export type ImageType =
  | 'photo'
  | 'age_progressed'
  | 'sketch'
  | 'cctv_still'
  | 'sighting'
  | 'document'

// ---------------------------------------------------------------
// Summary types (used in list responses)
// ---------------------------------------------------------------

export interface CaseSummary {
  id: string
  caseNumber: string
  caseType: CaseType
  status: CaseStatus
  urgency: CaseUrgency
  reportedAt: string
  lastSeenAt?: string
  lastSeenLocation?: string
  lastSeenCountry?: string
  source: CaseSource
  dataQuality: number
  persons: PersonSummary[]
  createdAt: string
  updatedAt: string
}

export interface PersonSummary {
  id: string
  role: PersonRole
  firstName?: string
  lastName?: string
  nickname?: string
  approximateAge?: number
  dateOfBirth?: string
  gender?: PersonGender
  primaryImageUrl?: string
}

// ---------------------------------------------------------------
// Full detail types (used in single item responses)
// ---------------------------------------------------------------

export interface CaseDetail extends CaseSummary {
  circumstances?: string
  rewardAmount?: number
  rewardCurrency?: string
  sourceUrl?: string
  lastSyncedAt?: string
  consentGiven: boolean
  resolvedAt?: string
  resolutionNotes?: string
  persons: PersonDetail[]
}

export interface PersonDetail extends PersonSummary {
  aliases: string[]
  ageAtDisappearance?: number
  nationality: string[]
  ethnicity?: string
  heightCm?: number
  weightKg?: number
  hairColor?: string
  hairLength?: string
  eyeColor?: string
  skinTone?: string
  distinguishingMarks?: string
  clothingDescription?: string
  medicalConditions?: string
  languagesSpoken: string[]
  images: ImageDetail[]
}

export interface ImageDetail {
  id: string
  storageUrl: string
  thumbnailUrl?: string
  imageType: ImageType
  isPrimary: boolean
  takenAt?: string
  sourceAttribution?: string
  width?: number
  height?: number
  hasFace?: boolean
  faceQualityScore?: number
  createdAt: string
}

// ---------------------------------------------------------------
// Case registration (family portal)
// ---------------------------------------------------------------

export interface CreateCaseRequest {
  caseType: CaseType
  reportedAt: string
  lastSeenAt?: string
  lastSeenLocation?: string
  lastSeenLat?: number
  lastSeenLng?: number
  lastSeenCountry?: string
  circumstances?: string
  persons: CreatePersonRequest[]
  consentType: 'parental' | 'legal_guardian' | 'vital_interest'
}

export interface CreatePersonRequest {
  role: PersonRole
  firstName?: string
  lastName?: string
  aliases?: string[]
  nickname?: string
  dateOfBirth?: string
  approximateAge?: number
  gender?: PersonGender
  nationality?: string[]
  heightCm?: number
  weightKg?: number
  hairColor?: string
  eyeColor?: string
  distinguishingMarks?: string
  clothingDescription?: string
  medicalConditions?: string
  languagesSpoken?: string[]
}

// ---------------------------------------------------------------
// Search
// ---------------------------------------------------------------

export interface CaseSearchFilters {
  query?: string
  status?: CaseStatus
  caseType?: CaseType
  urgency?: CaseUrgency
  country?: string
  source?: CaseSource
  ageMin?: number
  ageMax?: number
  gender?: PersonGender
  page?: number
  limit?: number
  sortBy?: 'reportedAt' | 'urgency' | 'dataQuality'
  sortOrder?: 'asc' | 'desc'
}

export interface SearchResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}
