// =============================================================
// Scheduler — E2-S08
// Cron-based periodic ingestion jobs via BullMQ repeatables
// =============================================================

import { queues } from '@/lib/redis'
import { logger } from '@/lib/logger'
import type { IngestionJobData } from '@/services/jobs/ingestion-worker'
import type { CaseSource } from '@prisma/client'

// ---------------------------------------------------------------
// Cron schedules per source (configured as per stories)
// ---------------------------------------------------------------
const INGESTION_SCHEDULES: Array<{
  queue: keyof typeof queues
  source: CaseSource
  cron: string
  description: string
}> = [
  {
    queue: 'ingestionFbi',
    source: 'fbi',
    cron: '0 */6 * * *',     // Every 6 hours
    description: 'FBI Wanted API — Missing Persons',
  },
  {
    queue: 'ingestionInterpol',
    source: 'interpol',
    cron: '30 */6 * * *',    // Every 6 hours, offset 30min to avoid overlap
    description: 'Interpol Yellow Notices',
  },
  {
    queue: 'ingestionNcmec',
    source: 'ncmec',
    cron: '*/60 * * * *',    // Every 60 minutes (30 when live API key available)
    description: 'NCMEC Poster API',
  },
  {
    queue: 'ingestionAmber',
    source: 'amber',
    cron: '*/15 * * * *',    // Every 15 minutes
    description: 'AMBER Alert RSS',
  },
]

// ---------------------------------------------------------------
// Register all repeatable ingestion jobs
// ---------------------------------------------------------------
export async function setupIngestionSchedules(): Promise<void> {
  logger.info('Scheduler: setting up ingestion schedules...')

  for (const schedule of INGESTION_SCHEDULES) {
    try {
      const queue = queues[schedule.queue]

      const jobData: IngestionJobData = {
        source: schedule.source,
        triggeredBy: 'scheduler',
      }

      await queue.upsertJobScheduler(
        `${String(schedule.source)}-scheduled`,
        { pattern: schedule.cron },
        {
          name: `ingestion-${String(schedule.source)}`,
          data: jobData,
          opts: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 30_000, // 30s initial backoff for scheduled jobs
            },
          },
        }
      )

      logger.info(
        {
          source: schedule.source,
          cron: schedule.cron,
          description: schedule.description,
        },
        'Scheduler: schedule registered'
      )
    } catch (err) {
      logger.error(
        { source: schedule.source, err },
        'Scheduler: failed to register schedule'
      )
    }
  }

  logger.info('Scheduler: all ingestion schedules registered')
}

// ---------------------------------------------------------------
// Trigger a manual ingestion job immediately
// ---------------------------------------------------------------
export async function triggerManualIngestion(
  source: CaseSource,
  options: IngestionJobData['options'] = {}
): Promise<string | undefined> {
  const schedule = INGESTION_SCHEDULES.find((s) => s.source === source)

  if (!schedule) {
    throw new Error(`Unknown source: ${source}. Available: ${INGESTION_SCHEDULES.map((s) => s.source).join(', ')}`)
  }

  const queue = queues[schedule.queue]

  const jobData: IngestionJobData = {
    source,
    triggeredBy: 'manual',
    options,
  }

  const job = await queue.add(
    `ingestion-${String(source)}-manual`,
    jobData,
    {
      priority: 1, // Higher priority than scheduled jobs
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    }
  )

  logger.info(
    { source, jobId: job.id },
    'Scheduler: manual ingestion job enqueued'
  )

  return job.id
}

// ---------------------------------------------------------------
// Get all active schedules with their next run time
// ---------------------------------------------------------------
export async function getScheduleStatus(): Promise<
  Array<{
    source: CaseSource
    cron: string
    description: string
    nextRunAt: Date | null
  }>
> {
  const statuses = []

  for (const schedule of INGESTION_SCHEDULES) {
    try {
      const queue = queues[schedule.queue]
      const repeatable = await queue.getJobSchedulers()
      const jobScheduler = repeatable.find(
        (r) => r.id === `${String(schedule.source)}-scheduled`
      )

      statuses.push({
        source: schedule.source,
        cron: schedule.cron,
        description: schedule.description,
        nextRunAt: jobScheduler?.next ? new Date(jobScheduler.next) : null,
      })
    } catch {
      statuses.push({
        source: schedule.source,
        cron: schedule.cron,
        description: schedule.description,
        nextRunAt: null,
      })
    }
  }

  return statuses
}

// ---------------------------------------------------------------
// Clear all ingestion schedules (for testing / reset)
// ---------------------------------------------------------------
export async function clearIngestionSchedules(): Promise<void> {
  logger.warn('Scheduler: clearing all ingestion schedules')

  for (const schedule of INGESTION_SCHEDULES) {
    try {
      const queue = queues[schedule.queue]
      await queue.removeJobScheduler(`${String(schedule.source)}-scheduled`)
      logger.info({ source: schedule.source }, 'Scheduler: schedule removed')
    } catch (err) {
      logger.error({ source: schedule.source, err }, 'Scheduler: failed to remove schedule')
    }
  }
}
