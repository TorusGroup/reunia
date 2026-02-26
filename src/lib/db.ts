import { PrismaClient } from '@prisma/client'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

// =============================================================
// Prisma Client Singleton (E1-S02)
// Prevents multiple instances in development (Next.js hot reload)
// =============================================================

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : [{ emit: 'event', level: 'error' }],
  })

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db

  // Log slow queries in development
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(db as unknown as any).$on('query', (e: { query: string; duration: number }) => {
    if (e.duration > 100) {
      logger.warn(
        { query: e.query.slice(0, 100), duration: e.duration },
        'Slow query detected'
      )
    }
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(db as unknown as any).$on('error', (e: { message: string }) => {
    logger.error({ err: e.message }, 'Prisma error')
  })
}

export default db
