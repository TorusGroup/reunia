import { logger } from '@/lib/logger'

// =============================================================
// Content Moderation Service (E8-S03 — Sprint 7)
// Flags suspicious sighting reports and uploads
// MVP: pattern-based + heuristics. Future: ML-based
// =============================================================

export type ModerationVerdict = 'approve' | 'flag' | 'reject'

export interface ModerationResult {
  verdict: ModerationVerdict
  score: number // 0-100 (higher = more suspicious)
  reasons: string[]
  requiresHumanReview: boolean
}

// ---------------------------------------------------------------
// Text content moderation
// ---------------------------------------------------------------

// Patterns that indicate spam or abuse
const SPAM_PATTERNS = [
  /\b(https?:\/\/[^\s]+){3,}/gi, // Multiple URLs
  /(.)\1{10,}/g, // Repeated characters (aaaaaaa...)
  /\b(buy now|click here|free money|earn \$|make money fast)/gi,
  /\b(call now|limited offer|act now|you have been selected)/gi,
]

// Patterns that could indicate malicious intent
const MALICIOUS_PATTERNS = [
  /<script/gi, // XSS attempt
  /javascript:/gi,
  /on\w+\s*=/gi, // Event handlers
  /data:text\/html/gi,
  /\beval\s*\(/gi,
  /\bexec\s*\(/gi,
]

// Patterns that suggest a sighting report might be false/abusive
const FALSE_REPORT_PATTERNS = [
  /\b(test|testing|fake|fictício|ficticio|lorem ipsum)\b/gi,
  /\b(1234|abcd|qwerty)\b/gi, // Placeholder text
  /([a-zA-Z])\1{5,}/g, // Excessive repetition
]

export function moderateTextContent(
  text: string,
  context: 'sighting' | 'case_description' | 'comment' = 'sighting'
): ModerationResult {
  const reasons: string[] = []
  let score = 0

  if (!text || typeof text !== 'string') {
    return {
      verdict: 'reject',
      score: 100,
      reasons: ['Conteúdo vazio ou inválido'],
      requiresHumanReview: false,
    }
  }

  const trimmed = text.trim()

  // Check minimum length
  if (trimmed.length < 10) {
    reasons.push('Conteúdo muito curto para ser válido')
    score += 30
  }

  // Check for spam patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(trimmed)) {
      reasons.push('Possível spam detectado')
      score += 25
      break
    }
  }

  // Check for malicious patterns
  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      reasons.push('Conteúdo potencialmente malicioso detectado')
      score += 50
      break
    }
  }

  // Check for false report patterns
  if (context === 'sighting') {
    for (const pattern of FALSE_REPORT_PATTERNS) {
      if (pattern.test(trimmed)) {
        reasons.push('Possível reporte de teste ou falso')
        score += 20
        break
      }
    }
  }

  // Very short reports for sightings are suspicious
  if (context === 'sighting' && trimmed.length < 30) {
    reasons.push('Descrição de avistamento muito breve')
    score += 15
  }

  const verdict: ModerationVerdict =
    score >= 70 ? 'reject' :
    score >= 30 ? 'flag' :
    'approve'

  return {
    verdict,
    score,
    reasons,
    requiresHumanReview: verdict === 'flag',
  }
}

// ---------------------------------------------------------------
// Sighting report moderation
// ---------------------------------------------------------------

export interface SightingModerationInput {
  description: string
  location?: string
  reporterInfo?: string
  ipAddress?: string
  previousReportsFromIp?: number
}

export function moderateSightingReport(
  input: SightingModerationInput
): ModerationResult {
  const textResult = moderateTextContent(input.description, 'sighting')
  let score = textResult.score
  const reasons = [...textResult.reasons]

  // Check if reporter has many recent reports (potential abuse)
  if (input.previousReportsFromIp !== undefined) {
    if (input.previousReportsFromIp >= 10) {
      reasons.push('Número elevado de reportes do mesmo IP')
      score += 30
    } else if (input.previousReportsFromIp >= 5) {
      reasons.push('Múltiplos reportes do mesmo IP')
      score += 15
    }
  }

  // Vague location is suspicious for sightings
  if (input.location && input.location.length < 5) {
    reasons.push('Localização muito vaga')
    score += 10
  }

  const verdict: ModerationVerdict =
    score >= 70 ? 'reject' :
    score >= 30 ? 'flag' :
    'approve'

  logger.debug(
    { score, verdict, reasons },
    'Sighting report moderation result'
  )

  return {
    verdict,
    score: Math.min(score, 100),
    reasons,
    requiresHumanReview: verdict === 'flag',
  }
}

// ---------------------------------------------------------------
// Image content moderation
// ---------------------------------------------------------------

export interface ImageModerationResult {
  verdict: ModerationVerdict
  reasons: string[]
  requiresHumanReview: boolean
}

// MVP: basic checks only. Production: add ML-based NSFW detection
export function moderateImageMetadata(
  filename: string,
  mimeType: string,
  fileSizeBytes: number
): ImageModerationResult {
  const reasons: string[] = []

  // Check file size (very small files might not be real photos)
  if (fileSizeBytes < 1024) {
    reasons.push('Arquivo de imagem suspeito (muito pequeno)')
    return { verdict: 'flag', reasons, requiresHumanReview: true }
  }

  // Check MIME type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(mimeType.toLowerCase())) {
    reasons.push(`Tipo de arquivo não permitido: ${mimeType}`)
    return { verdict: 'reject', reasons, requiresHumanReview: false }
  }

  // Check filename for suspicious patterns
  const suspiciousFilenames = /\.(exe|bat|cmd|sh|ps1|php|asp|jsp|js|css|html)/i
  if (suspiciousFilenames.test(filename)) {
    reasons.push('Nome de arquivo suspeito')
    return { verdict: 'reject', reasons, requiresHumanReview: false }
  }

  // All checks passed — still requires human review for face match results
  return {
    verdict: 'approve',
    reasons,
    requiresHumanReview: false,
  }
}
