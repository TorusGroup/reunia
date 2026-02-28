// =============================================================
// Ingestion Worker — E2-S08
// BullMQ worker that processes ingestion jobs per source
// =============================================================

import { Worker, type Job } from 'bullmq'
import { redisQueue } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { runIngestion } from '@/services/ingestion/pipeline'
import { fbiAdapter } from '@/services/ingestion/fbi-adapter'
import { interpolAdapter } from '@/services/ingestion/interpol-adapter'
// D-02: Use public adapter (no auth required) instead of private mock adapter
import { ncmecPublicAdapter } from '@/services/ingestion/ncmec-public-adapter'
import { amberAdapter } from '@/services/ingestion/amber-adapter'
import type { ISourceAdapter } from '@/services/ingestion/base-adapter'
import type { CaseSource } from '@prisma/client'

// ---------------------------------------------------------------
// Queue name → adapter mapping
// ---------------------------------------------------------------
const QUEUE_ADAPTER_MAP: Record<string, ISourceAdapter> = {
  'ingestion-fbi': fbiAdapter,
  'ingestion-interpol': interpolAdapter,
  'ingestion-ncmec': ncmecPublicAdapter,
  'ingestion-amber': amberAdapter,
}

// ---------------------------------------------------------------
// Job data shape
// ---------------------------------------------------------------
export interface IngestionJobData {
  source: CaseSource
  triggeredBy?: 'scheduler' | 'manual'
  options?: {
    page?: number
    since?: Date
    maxPages?: number
  }
}

// ---------------------------------------------------------------
// Create workers for all ingestion queues
// ---------------------------------------------------------------
export function createIngestionWorkers(): Worker[] {
  const workers: Worker[] = []

  for (const [queueName, adapter] of Object.entries(QUEUE_ADAPTER_MAP)) {
    const worker = new Worker<IngestionJobData>(
      queueName,
      async (job: Job<IngestionJobData>) => {
        const { source, triggeredBy = 'scheduler', options = {} } = job.data

        logger.info(
          { queueName, jobId: job.id, source, triggeredBy },
          'Ingestion worker: job started'
        )

        // Update progress
        await job.updateProgress(10)

        const result = await runIngestion(adapter, options)

        await job.updateProgress(100)

        logger.info(
          {
            queueName,
            jobId: job.id,
            source,
            recordsFetched: result.recordsFetched,
            recordsInserted: result.recordsInserted,
            recordsUpdated: result.recordsUpdated,
            recordsFailed: result.recordsFailed,
            durationMs: result.durationMs,
          },
          'Ingestion worker: job completed'
        )

        return result
      },
      {
        connection: redisQueue,
        concurrency: 1, // One job at a time per queue (respect rate limits)
        limiter: {
          max: 1,
          duration: 60_000, // Max 1 job per minute per queue
        },
      }
    )

    worker.on('completed', (job) => {
      logger.info(
        { queueName, jobId: job.id },
        'Ingestion worker: job completed successfully'
      )
    })

    worker.on('failed', (job, err) => {
      logger.error(
        { queueName, jobId: job?.id, err },
        'Ingestion worker: job failed'
      )
    })

    worker.on('error', (err) => {
      logger.error({ queueName, err }, 'Ingestion worker: worker error')
    })

    workers.push(worker)
    logger.info({ queueName }, 'Ingestion worker: started')
  }

  return workers
}

// ---------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------
export async function shutdownIngestionWorkers(workers: Worker[]): Promise<void> {
  logger.info('Ingestion workers: shutting down...')
  await Promise.all(workers.map((w) => w.close()))
  logger.info('Ingestion workers: all stopped')
}
