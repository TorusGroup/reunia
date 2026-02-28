// =============================================================
// ReunIA — HITL Validation Queue
// BullMQ queue for Human-in-the-Loop match review
// NON-NEGOTIABLE: no family notifications without human review
// =============================================================

import { Queue } from 'bullmq'
import { redisQueue } from '@/lib/redis'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { writeAuditLog } from '@/lib/audit'

// ---------------------------------------------------------------
// Queue configuration
// ---------------------------------------------------------------

export const HITL_QUEUE_NAME = 'hitl-validation'

interface HitlJobData {
  matchId: string
  priority: 'high' | 'normal' | 'low'
  enqueuedAt: string
}

// Lazy Queue creation — avoids eager Redis connection during `next build`
let _hitlQueue: Queue<HitlJobData> | null = null
function getHitlQueue(): Queue<HitlJobData> {
  if (!_hitlQueue) {
    _hitlQueue = new Queue<HitlJobData>(HITL_QUEUE_NAME, {
      connection: redisQueue,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 1000 },
      },
    })
  }
  return _hitlQueue
}

// ---------------------------------------------------------------
// Queue interface
// ---------------------------------------------------------------

export interface EnqueueInput {
  matchId: string
  priority: 'high' | 'normal' | 'low'
}

export interface QueueStatus {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

export const validationQueue = {
  /**
   * Enqueue a match for HITL review.
   * Priority determines position in queue — HIGH matches reviewed first.
   */
  async enqueue(input: EnqueueInput): Promise<string> {
    const { matchId, priority } = input

    const priorityNum = priority === 'high' ? 1 : priority === 'normal' ? 5 : 10

    const job = await getHitlQueue().add(
      'review-match',
      {
        matchId,
        priority,
        enqueuedAt: new Date().toISOString(),
      },
      {
        priority: priorityNum,
        jobId: `hitl:${matchId}`, // Idempotent — prevents duplicate queueing
      }
    )

    logger.info({ matchId, priority, jobId: job.id }, 'HITL: match enqueued for review')
    return job.id ?? matchId
  },

  /**
   * Get queue status counts.
   */
  async getStatus(): Promise<QueueStatus> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      getHitlQueue().getWaitingCount(),
      getHitlQueue().getActiveCount(),
      getHitlQueue().getCompletedCount(),
      getHitlQueue().getFailedCount(),
      getHitlQueue().getDelayedCount(),
    ])

    return { waiting, active, completed, failed, delayed }
  },

  /**
   * Get pending matches for the HITL review dashboard.
   * Returns matches in priority order.
   */
  async getPendingMatches(
    limit = 20,
    offset = 0
  ): Promise<
    Array<{
      id: string
      matchId: string
      priority: string
      enqueuedAt: string
      waitingMs: number
    }>
  > {
    const jobs = await getHitlQueue().getJobs(['waiting', 'delayed'], offset, offset + limit - 1)

    return jobs.map((job) => ({
      id: job.id ?? '',
      matchId: job.data.matchId,
      priority: job.data.priority,
      enqueuedAt: job.data.enqueuedAt,
      waitingMs: Date.now() - new Date(job.data.enqueuedAt).getTime(),
    }))
  },

  /**
   * Remove a job from queue (when match is resolved externally).
   */
  async remove(matchId: string): Promise<void> {
    try {
      const job = await getHitlQueue().getJob(`hitl:${matchId}`)
      if (job) {
        await job.remove()
        logger.info({ matchId }, 'HITL: job removed from queue')
      }
    } catch (err) {
      logger.warn({ err, matchId }, 'HITL: failed to remove job from queue')
    }
  },
}

// ---------------------------------------------------------------
// Validation actions
// ---------------------------------------------------------------

export type ValidationAction = 'confirm' | 'reject' | 'escalate'

export interface ValidateMatchInput {
  matchId: string
  reviewerId: string
  action: ValidationAction
  reviewNotes?: string
  reviewDurationSeconds?: number
}

/**
 * Record the outcome of a HITL review.
 * Updates Match record and removes from queue.
 * For 'confirm' — separate notification process is triggered.
 */
export async function validateMatch(input: ValidateMatchInput): Promise<void> {
  const { matchId, reviewerId, action, reviewNotes, reviewDurationSeconds } = input

  // Map action to DB values
  const reviewStatusMap: Record<ValidationAction, 'approved' | 'rejected' | 'escalated'> = {
    confirm: 'approved',
    reject: 'rejected',
    escalate: 'escalated',
  }

  const matchActionMap: Record<
    ValidationAction,
    'le_notified' | 'no_action' | 'le_notified'
  > = {
    confirm: 'le_notified',
    reject: 'no_action',
    escalate: 'le_notified',
  }

  try {
    await db.match.update({
      where: { id: matchId },
      data: {
        reviewStatus: reviewStatusMap[action],
        reviewerId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes ?? null,
        reviewDurationSeconds: reviewDurationSeconds ?? null,
        actionTaken: matchActionMap[action],
      },
    })

    // Remove from HITL queue
    await validationQueue.remove(matchId)

    // Audit log
    writeAuditLog({
      userId: reviewerId,
      action: 'hitl.review',
      resourceType: 'match',
      resourceId: matchId,
      details: {
        action,
        reviewDurationSeconds,
        hadNotes: Boolean(reviewNotes),
      },
    })

    logger.info(
      { matchId, reviewerId, action },
      'HITL: match validation recorded'
    )
  } catch (err) {
    logger.error({ err, matchId, reviewerId, action }, 'HITL: failed to record validation')
    throw new Error(
      `Failed to record validation: ${err instanceof Error ? err.message : 'Unknown error'}`
    )
  }
}

// ---------------------------------------------------------------
// Export queue instance for monitoring
// ---------------------------------------------------------------

// Lazy Proxy export for monitoring — avoids eager Redis connection during build
const IS_BUILD_VQ = process.env.NEXT_PHASE === 'phase-production-build'
export const hitlQueue: Queue<HitlJobData> = new Proxy({} as Queue<HitlJobData>, {
  get(_target, prop) {
    if (IS_BUILD_VQ) return undefined
    return (getHitlQueue() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
