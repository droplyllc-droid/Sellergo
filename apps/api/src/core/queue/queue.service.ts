import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job, QueueEvents, JobsOptions } from 'bullmq';
import Redis from 'ioredis';

// Queue names
export type QueueName =
  | 'email'
  | 'webhook'
  | 'analytics'
  | 'billing'
  | 'notifications'
  | 'integrations'
  | 'notification'
  | 'pixel'
  | 'domain'
  | 'inventory';

export const QueueNames = {
  EMAIL: 'email' as const,
  WEBHOOK: 'webhook' as const,
  ANALYTICS: 'analytics' as const,
  BILLING: 'billing' as const,
  NOTIFICATIONS: 'notifications' as const,
  INTEGRATIONS: 'integrations' as const,
  NOTIFICATION: 'notification' as const,
  PIXEL: 'pixel' as const,
  DOMAIN: 'domain' as const,
  INVENTORY: 'inventory' as const,
};

// Job types
export interface EmailJob {
  type: 'welcome' | 'verification' | 'password-reset' | 'order-confirmation' | 'team-invite';
  to: string;
  data: Record<string, unknown>;
}

export interface WebhookJob {
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  attempt?: number;
}

export interface AnalyticsJob {
  type: 'track' | 'aggregate' | 'export';
  data: Record<string, unknown>;
}

export interface BillingJob {
  type: 'charge-fee' | 'generate-invoice' | 'sync-stripe';
  data: Record<string, unknown>;
}

export interface NotificationJob {
  type: 'push' | 'in-app' | 'sms';
  userId: string;
  data: Record<string, unknown>;
}

export type JobData = EmailJob | WebhookJob | AnalyticsJob | BillingJob | NotificationJob;

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly connection: Redis;
  private readonly queues: Map<QueueName, Queue> = new Map();
  private readonly workers: Map<QueueName, Worker> = new Map();
  private readonly queueEvents: Map<QueueName, QueueEvents> = new Map();

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('redis.url') ?? 'redis://localhost:6379';

    this.connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    // Initialize queues
    for (const queueName of Object.values(QueueNames)) {
      this.initializeQueue(queueName);
    }
  }

  private initializeQueue(name: QueueName): void {
    const queue = new Queue(name, {
      connection: this.connection as any,
      defaultJobOptions: {
        removeOnComplete: {
          age: 3600, // Remove completed jobs after 1 hour
          count: 1000, // Keep at most 1000 completed jobs
        },
        removeOnFail: {
          age: 86400 * 7, // Remove failed jobs after 7 days
        },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    const queueEvents = new QueueEvents(name, {
      connection: this.connection as any,
    });

    // Log queue events
    queueEvents.on('completed', ({ jobId }) => {
      this.logger.debug(`Job ${jobId} completed in queue ${name}`);
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.logger.error(`Job ${jobId} failed in queue ${name}: ${failedReason}`);
    });

    this.queues.set(name, queue);
    this.queueEvents.set(name, queueEvents);
  }

  async onModuleDestroy(): Promise<void> {
    // Close all workers
    for (const worker of this.workers.values()) {
      await worker.close();
    }

    // Close all queue events
    for (const events of this.queueEvents.values()) {
      await events.close();
    }

    // Close all queues
    for (const queue of this.queues.values()) {
      await queue.close();
    }

    // Close Redis connection
    this.connection.disconnect();

    this.logger.log('Queue service disconnected');
  }

  /**
   * Get a queue by name
   */
  getQueue(name: QueueName): Queue {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue ${name} not found`);
    }
    return queue;
  }

  /**
   * Add a job to a queue
   */
  async addJob<T extends JobData>(
    queueName: QueueName,
    jobName: string,
    data: T,
    options?: JobsOptions
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName);
    return queue.add(jobName, data, options);
  }

  /**
   * Add a job with delay
   */
  async addDelayedJob<T extends JobData>(
    queueName: QueueName,
    jobName: string,
    data: T,
    delayMs: number,
    options?: Omit<JobsOptions, 'delay'>
  ): Promise<Job<T>> {
    return this.addJob(queueName, jobName, data, {
      ...options,
      delay: delayMs,
    });
  }

  /**
   * Add a scheduled/recurring job
   */
  async addScheduledJob<T extends JobData>(
    queueName: QueueName,
    jobName: string,
    data: T,
    cron: string,
    options?: Omit<JobsOptions, 'repeat'>
  ): Promise<Job<T>> {
    return this.addJob(queueName, jobName, data, {
      ...options,
      repeat: {
        pattern: cron,
      },
    });
  }

  /**
   * Register a worker for a queue
   */
  registerWorker<T extends JobData>(
    queueName: QueueName,
    processor: (job: Job<T>) => Promise<void>
  ): Worker<T> {
    const existingWorker = this.workers.get(queueName);
    if (existingWorker) {
      this.logger.warn(`Worker for queue ${queueName} already exists, replacing`);
      existingWorker.close();
    }

    const worker = new Worker<T>(
      queueName,
      async (job) => {
        const startTime = Date.now();
        this.logger.debug(`Processing job ${job.id} in queue ${queueName}`);

        try {
          await processor(job);
          const duration = Date.now() - startTime;
          this.logger.debug(
            `Job ${job.id} processed successfully in ${duration}ms`
          );
        } catch (error) {
          const duration = Date.now() - startTime;
          this.logger.error(
            `Job ${job.id} failed after ${duration}ms:`,
            error instanceof Error ? error.message : error
          );
          throw error;
        }
      },
      {
        connection: this.connection as any,
        concurrency: 5,
        limiter: {
          max: 10,
          duration: 1000,
        },
      }
    );

    worker.on('error', (error) => {
      this.logger.error(`Worker error in queue ${queueName}:`, error);
    });

    this.workers.set(queueName, worker as Worker<JobData>);
    return worker;
  }

  /**
   * Get job by ID
   */
  async getJob<T extends JobData>(
    queueName: QueueName,
    jobId: string
  ): Promise<Job<T> | undefined> {
    const queue = this.getQueue(queueName);
    return queue.getJob(jobId) as Promise<Job<T> | undefined>;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: QueueName): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.getQueue(queueName);
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Clear all jobs from a queue
   */
  async clearQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.drain();
    this.logger.log(`Queue ${queueName} cleared`);
  }

  /**
   * Retry failed jobs
   */
  async retryFailedJobs(queueName: QueueName): Promise<number> {
    const queue = this.getQueue(queueName);
    const failedJobs = await queue.getFailed();

    let retried = 0;
    for (const job of failedJobs) {
      await job.retry();
      retried++;
    }

    this.logger.log(`Retried ${retried} failed jobs in queue ${queueName}`);
    return retried;
  }

  // ==========================================================================
  // CONVENIENCE METHODS
  // ==========================================================================

  /**
   * Queue an email job
   */
  async queueEmail(job: EmailJob, options?: JobsOptions): Promise<Job<EmailJob>> {
    return this.addJob('email', `email:${job.type}`, job, options);
  }

  /**
   * Queue a webhook delivery
   */
  async queueWebhook(
    job: WebhookJob,
    options?: JobsOptions
  ): Promise<Job<WebhookJob>> {
    return this.addJob('webhook', `webhook:${job.event}`, job, {
      ...options,
      jobId: `${job.webhookId}:${job.event}:${Date.now()}`,
    });
  }

  /**
   * Queue an analytics event
   */
  async queueAnalytics(
    job: AnalyticsJob,
    options?: JobsOptions
  ): Promise<Job<AnalyticsJob>> {
    return this.addJob('analytics', `analytics:${job.type}`, job, options);
  }

  /**
   * Queue a billing operation
   */
  async queueBilling(
    job: BillingJob,
    options?: JobsOptions
  ): Promise<Job<BillingJob>> {
    return this.addJob('billing', `billing:${job.type}`, job, options);
  }
}
