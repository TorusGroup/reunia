import { z } from 'zod'

// =============================================================
// Environment Variable Validation (E1-S07)
// All vars validated at startup — app fails fast if misconfigured
// =============================================================

const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL URL'),
  DIRECT_DATABASE_URL: z.string().url().optional(),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  REDIS_QUEUE_URL: z.string().optional(),

  // JWT
  JWT_PRIVATE_KEY: z.string().min(1, 'JWT_PRIVATE_KEY is required'),
  JWT_PUBLIC_KEY: z.string().min(1, 'JWT_PUBLIC_KEY is required'),
  JWT_ACCESS_TOKEN_TTL: z
    .string()
    .transform(Number)
    .pipe(z.number().positive())
    .default('900'),
  JWT_REFRESH_TOKEN_TTL: z
    .string()
    .transform(Number)
    .pipe(z.number().positive())
    .default('604800'),

  // Encryption (for MFA secrets)
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),

  // Application
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3000/api/v1'),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is required'),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is required'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is required'),
  CLOUDINARY_UPLOAD_PRESET: z.string().default('reunia_photos'),
  CLOUDINARY_BASE_FOLDER: z.string().default('reunia'),

  // Face Engine
  FACE_ENGINE_URL: z.string().url().default('http://localhost:8001'),
  FACE_ENGINE_API_KEY: z.string().min(1).default('local_dev_key'),
  FACE_ENGINE_TIMEOUT: z
    .string()
    .transform(Number)
    .pipe(z.number().positive())
    .default('5000'),

  // Logging
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
  LOG_PRETTY: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
})

// Create a partial schema for optional external services
const optionalEnvSchema = z.object({
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  NCMEC_API_KEY: z.string().optional(),
  OPENSANCTIONS_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
})

function validateEnv() {
  // In test environment, be lenient with missing vars
  if (process.env.NODE_ENV === 'test') {
    return {
      ...process.env,
      NODE_ENV: 'test' as const,
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
      JWT_PRIVATE_KEY: process.env.JWT_PRIVATE_KEY ?? 'test-private-key',
      JWT_PUBLIC_KEY: process.env.JWT_PUBLIC_KEY ?? 'test-public-key',
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? 'test-encryption-key-32-chars-xxxx',
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? 'test',
      CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ?? 'test',
      CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ?? 'test',
      JWT_ACCESS_TOKEN_TTL: 900,
      JWT_REFRESH_TOKEN_TTL: 604800,
      FACE_ENGINE_TIMEOUT: 5000,
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      NEXT_PUBLIC_API_URL: 'http://localhost:3000/api/v1',
      CLOUDINARY_UPLOAD_PRESET: 'reunia_photos',
      CLOUDINARY_BASE_FOLDER: 'reunia',
      FACE_ENGINE_URL: 'http://localhost:8001',
      FACE_ENGINE_API_KEY: 'test',
      LOG_LEVEL: 'warn' as const,
      LOG_PRETTY: false,
    }
  }

  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('Environment validation failed:')
    console.error(result.error.flatten().fieldErrors)
    throw new Error(
      `Invalid environment variables:\n${JSON.stringify(result.error.flatten().fieldErrors, null, 2)}`
    )
  }

  return result.data
}

// Export validated env — this runs at module load time
// Server-side only (never include sensitive vars in client bundle)
export const env = validateEnv()

// Export types for type-safe access
export type Env = z.infer<typeof envSchema>
