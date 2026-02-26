// =============================================================
// Input Sanitization Utilities (E8-S02 — Sprint 7)
// DOMPurify-style sanitization, SQL injection prevention,
// path traversal prevention, and image upload validation
// =============================================================

// ---------------------------------------------------------------
// Text sanitization
// ---------------------------------------------------------------

// Characters that are dangerous in HTML contexts
const HTML_ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
}

// Sanitize arbitrary user input — removes/escapes dangerous characters
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return ''

  return input
    .trim()
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters (except newline, tab, carriage return)
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Escape HTML special characters
    .replace(/[&<>"'`=/]/g, (char) => HTML_ENTITY_MAP[char] ?? char)
    // Normalize whitespace (collapse multiple spaces to one)
    .replace(/\s+/g, ' ')
    // Limit length to prevent payload attacks
    .slice(0, 10000)
}

// Sanitize for display (less aggressive — preserves some formatting)
export function sanitizeDisplayText(input: string): string {
  if (typeof input !== 'string') return ''

  return input
    .trim()
    .replace(/\0/g, '')
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[<>]/g, (char) => HTML_ENTITY_MAP[char] ?? char)
    .slice(0, 50000)
}

// ---------------------------------------------------------------
// Search query sanitization — SQL injection prevention
// ---------------------------------------------------------------

// Characters that could affect SQL queries or search syntax
const SQL_INJECTION_PATTERNS = [
  /(\b)(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|GRANT|REVOKE|TRUNCATE)(\b)/gi,
  /--/g, // SQL comment
  /\/\*/g, // Block comment start
  /\*\//g, // Block comment end
  /;/g, // Statement terminator
  /\bxp_\w+/gi, // Extended stored procedures
  /\bsp_\w+/gi, // System stored procedures
]

export function sanitizeSearchQuery(query: string): string {
  if (typeof query !== 'string') return ''

  let sanitized = query
    .trim()
    .replace(/\0/g, '')
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // Remove SQL injection patterns
  for (const pattern of SQL_INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, ' ')
  }

  // Escape single quotes (primary SQL injection vector)
  sanitized = sanitized.replace(/'/g, "''")

  // Remove excessive whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim()

  // Limit length
  return sanitized.slice(0, 500)
}

// Sanitize for PostgreSQL full-text search tsvector
export function sanitizeFtsQuery(query: string): string {
  if (typeof query !== 'string') return ''

  // Keep only alphanumeric, spaces, hyphens, and apostrophes for FTS
  return query
    .trim()
    .replace(/[^\p{L}\p{N}\s\-']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}

// ---------------------------------------------------------------
// File name sanitization — path traversal prevention
// ---------------------------------------------------------------

const PATH_TRAVERSAL_PATTERNS = [
  /\.\./g, // Parent directory
  /\./g, // Current directory or hidden file
  /[/\\]/g, // Path separators
  /[<>:"|?*]/g, // Windows forbidden characters
  /[\x00-\x1F\x7F]/g, // Control characters
  /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(\..*)?$/i, // Windows reserved names
]

export function sanitizeFileName(name: string): string {
  if (typeof name !== 'string') return 'upload'

  let sanitized = name.trim()

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '')

  // Replace path separators and traversal patterns with underscore
  sanitized = sanitized.replace(/[/\\]/g, '_')
  sanitized = sanitized.replace(/\.\./g, '_')

  // Remove other forbidden characters
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1F\x7F]/g, '_')

  // Collapse multiple underscores/spaces
  sanitized = sanitized.replace(/[_\s]+/g, '_').replace(/^[_]+|[_]+$/g, '')

  // Limit length (max 255 chars, POSIX limit)
  sanitized = sanitized.slice(0, 255)

  // Fallback if sanitization results in empty string
  if (!sanitized) return 'upload'

  // Check for Windows reserved names after sanitization
  if (/^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/i.test(sanitized)) {
    return `file_${sanitized}`
  }

  return sanitized
}

// ---------------------------------------------------------------
// Image upload validation
// ---------------------------------------------------------------

export interface ValidationResult {
  valid: boolean
  error?: string
}

// Allowed MIME types for uploaded images
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

// Maximum file size: 10MB
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

// Magic bytes for image file type verification
const IMAGE_MAGIC_BYTES: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF header (check bytes 8-11 for WEBP)
  'image/gif': [0x47, 0x49, 0x46, 0x38], // GIF8
}

export function validateImageUpload(file: File): ValidationResult {
  // Check file exists
  if (!file) {
    return { valid: false, error: 'Nenhum arquivo fornecido' }
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Arquivo muito grande. Máximo permitido: ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`,
    }
  }

  // Check MIME type
  if (!ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase())) {
    return {
      valid: false,
      error: `Tipo de arquivo não permitido: ${file.type}. Use JPEG, PNG, WebP ou GIF.`,
    }
  }

  // Check filename
  if (!file.name) {
    return { valid: false, error: 'Nome de arquivo inválido' }
  }

  const sanitizedName = sanitizeFileName(file.name)
  if (!sanitizedName) {
    return { valid: false, error: 'Nome de arquivo inválido' }
  }

  return { valid: true }
}

// Server-side image validation with magic bytes check
export async function validateImageBuffer(
  buffer: ArrayBuffer,
  declaredMimeType: string
): Promise<ValidationResult> {
  const bytes = new Uint8Array(buffer)

  if (bytes.length < 4) {
    return { valid: false, error: 'Arquivo de imagem inválido ou corrompido' }
  }

  if (!ALLOWED_IMAGE_TYPES.has(declaredMimeType.toLowerCase())) {
    return {
      valid: false,
      error: `Tipo MIME não permitido: ${declaredMimeType}`,
    }
  }

  // Verify magic bytes match declared type
  const expectedMagic = IMAGE_MAGIC_BYTES[declaredMimeType.toLowerCase()]
  if (expectedMagic) {
    const actualBytes = Array.from(bytes.slice(0, expectedMagic.length))
    const matches = expectedMagic.every((byte, i) => actualBytes[i] === byte)

    if (!matches) {
      // Extra check for WebP (magic bytes at offset 8-11)
      if (declaredMimeType === 'image/webp') {
        const webpSignature = Array.from(bytes.slice(8, 12))
        const webpExpected = [0x57, 0x45, 0x42, 0x50] // WEBP
        const isWebp = webpExpected.every((byte, i) => webpSignature[i] === byte)
        if (!isWebp) {
          return { valid: false, error: 'Conteúdo do arquivo não corresponde ao tipo declarado' }
        }
      } else {
        return { valid: false, error: 'Conteúdo do arquivo não corresponde ao tipo declarado' }
      }
    }
  }

  // Check file size (buffer)
  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Arquivo muito grande. Máximo: ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`,
    }
  }

  return { valid: true }
}

// ---------------------------------------------------------------
// URL sanitization
// ---------------------------------------------------------------

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') return ''

  try {
    const parsed = new URL(url)
    if (!SAFE_URL_PROTOCOLS.has(parsed.protocol)) {
      return ''
    }
    return parsed.toString()
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------
// Phone number sanitization
// ---------------------------------------------------------------

export function sanitizePhone(phone: string): string {
  if (typeof phone !== 'string') return ''
  // Keep only digits, spaces, +, -, (, )
  return phone.replace(/[^\d\s+\-()]/g, '').trim().slice(0, 20)
}

// ---------------------------------------------------------------
// Email sanitization
// ---------------------------------------------------------------

export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return ''
  return email.trim().toLowerCase().slice(0, 254)
}

// ---------------------------------------------------------------
// Numeric input sanitization
// ---------------------------------------------------------------

export function sanitizePositiveInteger(value: unknown, max = Number.MAX_SAFE_INTEGER): number | null {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) return null
  return Math.min(num, max)
}

export function sanitizeFloat(value: unknown, min?: number, max?: number): number | null {
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  if (min !== undefined && num < min) return null
  if (max !== undefined && num > max) return null
  return num
}
