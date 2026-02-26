import pino from 'pino'
import { env } from '@/lib/env'

// =============================================================
// Structured Logging with Pino (E1-S06)
// JSON in production, pretty-printed in development
// =============================================================

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.LOG_PRETTY && env.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {
        // Production: structured JSON
        formatters: {
          level: (label: string) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
  base: {
    service: 'reunia-api',
    env: env.NODE_ENV,
  },
  // Redact sensitive fields from logs
  redact: {
    paths: [
      'password',
      'passwordHash',
      'mfaSecret',
      'mfaBackupCodes',
      'emailVerifyToken',
      'passwordResetToken',
      '*.password',
      '*.token',
      '*.secret',
      'authorization',
      'cookie',
    ],
    censor: '[REDACTED]',
  },
})

// Child logger factory for scoped logging
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context)
}

// Request logger factory
export function createRequestLogger(requestId: string, userId?: string) {
  return logger.child({
    requestId,
    ...(userId ? { userId } : {}),
  })
}

export default logger
