// =============================================================
// ReunIA — BullMQ Worker Entry Point
// Standalone process that consumes all job queues.
// Run: npx tsx src/worker.ts
// =============================================================
// D-01: Create BullMQ Worker Entry Point and Deploy Strategy
// Sprint 2 — Data Pipeline + Infrastructure
// =============================================================

import { createIngestionWorkers, shutdownIngestionWorkers } from '@/services/jobs/ingestion-worker'
import { startAlertWorker, stopAlertWorker } from '@/services/jobs/alert-worker'
import { startBroadcastWorker, stopBroadcastWorker } from '@/services/jobs/broadcast-worker'
import { startDigestWorker, stopDigestWorker } from '@/services/jobs/digest-worker'
import { setupIngestionSchedules } from '@/services/jobs/scheduler'
import { logger } from '@/lib/logger'
import type { Worker } from 'bullmq'

// ---------------------------------------------------------------
// Worker registry — tracks all active workers for graceful shutdown
// ---------------------------------------------------------------
const activeWorkers: {
  ingestion: Worker[]
  alert: Worker | null
  broadcast: Worker | null
  digest: Worker | null
} = {
  ingestion: [],
  alert: null,
  broadcast: null,
  digest: null,
}

let isShuttingDown = false

// ---------------------------------------------------------------
// Start all workers
// ---------------------------------------------------------------
async function startAllWorkers(): Promise<void> {
  logger.info('=== ReunIA Worker Process Starting ===')
  logger.info({ pid: process.pid, nodeVersion: process.version }, 'Worker: process info')

  try {
    // 1. Start ingestion workers (one per source: FBI, Interpol, NCMEC, AMBER)
    logger.info('Worker: starting ingestion workers...')
    activeWorkers.ingestion = createIngestionWorkers()
    logger.info(
      { count: activeWorkers.ingestion.length },
      'Worker: ingestion workers started'
    )

    // 2. Start alert worker
    logger.info('Worker: starting alert worker...')
    activeWorkers.alert = startAlertWorker()

    // 3. Start broadcast worker (AMBER alerts)
    logger.info('Worker: starting broadcast worker...')
    activeWorkers.broadcast = startBroadcastWorker()

    // 4. Start digest worker (daily/weekly email digests)
    logger.info('Worker: starting digest worker...')
    activeWorkers.digest = startDigestWorker()

    // 5. Register cron schedules for periodic ingestion
    logger.info('Worker: setting up ingestion schedules...')
    await setupIngestionSchedules()

    // Summary
    const queueNames = [
      ...activeWorkers.ingestion.map((w) => w.name),
      activeWorkers.alert?.name ?? 'alert-distribution',
      activeWorkers.broadcast?.name ?? 'alert-distribution (broadcast)',
      activeWorkers.digest?.name ?? 'alert-digest',
    ]

    logger.info(
      { queues: queueNames, totalWorkers: queueNames.length },
      'Worker started, processing queues: ' + queueNames.join(', ')
    )
    logger.info('=== ReunIA Worker Process Ready ===')
  } catch (err) {
    logger.error({ err }, 'Worker: failed to start')
    process.exit(1)
  }
}

// ---------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn({ signal }, 'Worker: already shutting down, ignoring signal')
    return
  }

  isShuttingDown = true
  logger.info({ signal }, 'Worker: graceful shutdown initiated')

  const shutdownTimeout = setTimeout(() => {
    logger.error('Worker: shutdown timed out after 30s, forcing exit')
    process.exit(1)
  }, 30_000)

  try {
    // Stop all workers in parallel
    await Promise.all([
      shutdownIngestionWorkers(activeWorkers.ingestion),
      stopAlertWorker(),
      stopBroadcastWorker(),
      stopDigestWorker(),
    ])

    clearTimeout(shutdownTimeout)
    logger.info('Worker: all workers stopped successfully')
    process.exit(0)
  } catch (err) {
    clearTimeout(shutdownTimeout)
    logger.error({ err }, 'Worker: error during shutdown')
    process.exit(1)
  }
}

// ---------------------------------------------------------------
// Signal handlers
// ---------------------------------------------------------------
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Worker: uncaught exception')
  gracefulShutdown('uncaughtException')
})

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Worker: unhandled rejection')
  gracefulShutdown('unhandledRejection')
})

// ---------------------------------------------------------------
// Start
// ---------------------------------------------------------------
startAllWorkers().catch((err) => {
  logger.error({ err }, 'Worker: fatal startup error')
  process.exit(1)
})
