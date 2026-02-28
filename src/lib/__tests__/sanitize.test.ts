// =============================================================
// Sanitization module unit tests (Q-01)
// Tests: HTML escaping, SQL injection, path traversal, XSS, filenames
// =============================================================

import {
  sanitizeInput,
  sanitizeSearchQuery,
  sanitizeFtsQuery,
  sanitizeFileName,
  sanitizeUrl,
  sanitizePhone,
  sanitizeEmail,
  sanitizePositiveInteger,
  sanitizeFloat,
} from '@/lib/sanitize'

describe('sanitize', () => {
  // ---------------------------------------------------------------
  // HTML entity escaping
  // ---------------------------------------------------------------
  describe('sanitizeInput', () => {
    it('should escape HTML special characters', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
      )
    })

    it('should remove null bytes', () => {
      expect(sanitizeInput('hello\0world')).toBe('hello world')
    })

    it('should remove control characters', () => {
      expect(sanitizeInput('hello\x01\x02\x03world')).toBe('hello world')
    })

    it('should collapse whitespace', () => {
      expect(sanitizeInput('hello    world')).toBe('hello world')
    })

    it('should trim input', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello')
    })

    it('should handle non-string input gracefully', () => {
      expect(sanitizeInput(null as unknown as string)).toBe('')
      expect(sanitizeInput(undefined as unknown as string)).toBe('')
      expect(sanitizeInput(123 as unknown as string)).toBe('')
    })

    it('should limit length to 10000 chars', () => {
      const longString = 'a'.repeat(20000)
      expect(sanitizeInput(longString).length).toBeLessThanOrEqual(10000)
    })
  })

  // ---------------------------------------------------------------
  // SQL injection prevention
  // ---------------------------------------------------------------
  describe('sanitizeSearchQuery', () => {
    it('should remove SQL keywords', () => {
      const result = sanitizeSearchQuery("Robert'; DROP TABLE users;--")
      expect(result).not.toContain('DROP')
      expect(result).not.toContain('--')
      expect(result).not.toContain(';')
    })

    it('should remove UNION SELECT patterns', () => {
      const result = sanitizeSearchQuery("' UNION SELECT * FROM users --")
      expect(result).not.toContain('UNION')
      expect(result).not.toContain('SELECT')
    })

    it('should escape single quotes', () => {
      const result = sanitizeSearchQuery("O'Brien")
      expect(result).toContain("''")
    })

    it('should handle normal search queries', () => {
      const result = sanitizeSearchQuery('Maria Santos')
      expect(result).toBe('Maria Santos')
    })

    it('should limit length to 500 chars', () => {
      const longQuery = 'a'.repeat(1000)
      expect(sanitizeSearchQuery(longQuery).length).toBeLessThanOrEqual(500)
    })
  })

  // ---------------------------------------------------------------
  // Full-text search sanitization
  // ---------------------------------------------------------------
  describe('sanitizeFtsQuery', () => {
    it('should keep letters and numbers', () => {
      expect(sanitizeFtsQuery('Maria Santos 123')).toBe('Maria Santos 123')
    })

    it('should remove special characters', () => {
      const result = sanitizeFtsQuery('Maria; DROP TABLE--')
      expect(result).not.toContain(';')
      expect(result).not.toContain('--')
    })

    it('should handle unicode names', () => {
      const result = sanitizeFtsQuery('João André')
      expect(result).toContain('João')
      expect(result).toContain('André')
    })
  })

  // ---------------------------------------------------------------
  // Path traversal prevention
  // ---------------------------------------------------------------
  describe('sanitizeFileName', () => {
    it('should remove path traversal sequences', () => {
      expect(sanitizeFileName('../../etc/passwd')).not.toContain('..')
      expect(sanitizeFileName('../../etc/passwd')).not.toContain('/')
    })

    it('should remove path separators', () => {
      expect(sanitizeFileName('path/to/file.txt')).not.toContain('/')
      expect(sanitizeFileName('path\\to\\file.txt')).not.toContain('\\')
    })

    it('should handle Windows reserved names', () => {
      expect(sanitizeFileName('CON')).toBe('file_CON')
      expect(sanitizeFileName('PRN')).toBe('file_PRN')
      expect(sanitizeFileName('NUL')).toBe('file_NUL')
    })

    it('should remove forbidden characters', () => {
      const result = sanitizeFileName('file<>:"|?*.txt')
      expect(result).not.toContain('<')
      expect(result).not.toContain('>')
      expect(result).not.toContain(':')
      expect(result).not.toContain('|')
      expect(result).not.toContain('?')
      expect(result).not.toContain('*')
    })

    it('should return "upload" for empty or invalid input', () => {
      expect(sanitizeFileName('')).toBe('upload')
      expect(sanitizeFileName('...')).toBe('upload')
      expect(sanitizeFileName(null as unknown as string)).toBe('upload')
    })

    it('should limit length to 255 chars', () => {
      const longName = 'a'.repeat(500) + '.jpg'
      expect(sanitizeFileName(longName).length).toBeLessThanOrEqual(255)
    })

    it('should handle unicode file names', () => {
      const result = sanitizeFileName('foto_criança_2026.jpg')
      expect(result).toBeTruthy()
      expect(result).not.toBe('upload')
    })
  })

  // ---------------------------------------------------------------
  // XSS payloads
  // ---------------------------------------------------------------
  describe('XSS payload neutralization', () => {
    const xssPayloads = [
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)>',
      'javascript:alert(1)',
      '<iframe src="javascript:alert(1)">',
      '<body onload=alert(1)>',
      '"><script>alert(document.cookie)</script>',
    ]

    for (const payload of xssPayloads) {
      it(`should neutralize: ${payload.slice(0, 40)}...`, () => {
        const result = sanitizeInput(payload)
        expect(result).not.toContain('<script>')
        expect(result).not.toContain('<img')
        expect(result).not.toContain('<svg')
        expect(result).not.toContain('<iframe')
        expect(result).not.toContain('<body')
      })
    }
  })

  // ---------------------------------------------------------------
  // URL sanitization
  // ---------------------------------------------------------------
  describe('sanitizeUrl', () => {
    it('should allow http/https URLs', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com/')
      expect(sanitizeUrl('http://example.com')).toBe('http://example.com/')
    })

    it('should block javascript: URLs', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBe('')
    })

    it('should block data: URLs', () => {
      expect(sanitizeUrl('data:text/html,<h1>Hello</h1>')).toBe('')
    })

    it('should return empty for invalid URLs', () => {
      expect(sanitizeUrl('not-a-url')).toBe('')
      expect(sanitizeUrl('')).toBe('')
    })
  })

  // ---------------------------------------------------------------
  // Other sanitizers
  // ---------------------------------------------------------------
  describe('sanitizePhone', () => {
    it('should keep digits and phone characters', () => {
      expect(sanitizePhone('+55 (11) 99999-0000')).toBe('+55 (11) 99999-0000')
    })

    it('should remove non-phone characters', () => {
      expect(sanitizePhone('phone: abc123')).toBe(' 123')
    })
  })

  describe('sanitizeEmail', () => {
    it('should lowercase and trim', () => {
      expect(sanitizeEmail('  User@Example.COM  ')).toBe('user@example.com')
    })
  })

  describe('sanitizePositiveInteger', () => {
    it('should accept valid positive integers', () => {
      expect(sanitizePositiveInteger(42)).toBe(42)
      expect(sanitizePositiveInteger(0)).toBe(0)
    })

    it('should reject negative numbers', () => {
      expect(sanitizePositiveInteger(-1)).toBeNull()
    })

    it('should reject non-numbers', () => {
      expect(sanitizePositiveInteger('abc')).toBeNull()
      expect(sanitizePositiveInteger(NaN)).toBeNull()
    })

    it('should respect max parameter', () => {
      expect(sanitizePositiveInteger(1000, 100)).toBe(100)
    })
  })

  describe('sanitizeFloat', () => {
    it('should accept valid floats within range', () => {
      expect(sanitizeFloat(3.14, 0, 10)).toBe(3.14)
    })

    it('should reject out of range', () => {
      expect(sanitizeFloat(100, 0, 10)).toBeNull()
      expect(sanitizeFloat(-5, 0, 10)).toBeNull()
    })

    it('should reject non-numbers', () => {
      expect(sanitizeFloat(NaN)).toBeNull()
      expect(sanitizeFloat(Infinity)).toBeNull()
    })
  })
})
