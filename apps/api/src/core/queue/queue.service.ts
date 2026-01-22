import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job, QueueEvents, JobsOptions } from 'bullmq';
import Redis from 'ioredis';

// Queue names
export enum QueueName {
  EMAIL = 'email',
  WEBHOOK = 'webhook',
  ANALYTICS = 'analytics',
  BILLING = 'billing',
  NOTIFICATIONS = 'notifications',
  INTEGRATIONS = 'integrations',
  ORDER = 'order',
  DOMAIN = 'domain',
}

// Job types
export interface EmailJob {
  type: 'welcome' | 'verification' | 'password-reset' | 'order-confirmation' | 'team-invite' | 'team-invitation';
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
  storeId?: string;
  data: Record<string, unknown>;
}

export interface NotificationJob {
  type: 'push' | 'in-app' | 'sms';
  userId: string;
  data: Record<string, unknown>;
}

export interface OrderJob {
  orderId: string;
  storeId?: string;
  trackingNumber?: string;
  carrier?: string;
  data?: Record<string, unknown>;
}

export interface DomainJob {
  domainId: string;
  domain: string;
  data?: Record<string, unknown>;
}

export interface IntegrationJob {
  pixelId?: string;
  webhookId?: string;
  storeId?: string;
  event?: string;
  data?: Record<string, unknown>;
}

export interface CartJob {
  cartId: string;
  storeId?: string;
  data?: Record<string, unknown>;
}

export type JobData =
  | EmailJob
  | WebhookJob
  | AnalyticsJob
  | BillingJob
  | NotificationJob
  | OrderJob
  | DomainJob
  | IntegrationJob
  | CartJob;

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
    for (const queueName of Object.values(QueueName)) {
      this.initializeQueue(queueName);
    }
  }

  private initializeQueue(name: QueueName): void {
    const queue = new Queue(name, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  getQueue(name: QueueName | string): Queue {
    // Support both enum and string queue names
    const queueName = name as QueueName;
    let queue = this.queues.get(queueName);

    // If not found, try to initialize it dynamically
    if (!queue) {
      this.initializeQueue(queueName);
      queue = this.queues.get(queueName);
    }

    if (!queue) {
      throw new Error(`Queue ${name} not found`);
    }
    return queue;
  }

  /**
   * Add a job to a queue
   */
  async addJob<T extends JobData>(
    queueName: QueueName | string,
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
    queueName: QueueName | string,
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
    queueName: QueueName | string,
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
    queueName: QueueName | string,
    processor: (job: Job<T>) => Promise<void>
  ): Worker<T> {
    const queueKey = queueName as QueueName;
    const existingWorker = this.workers.get(queueKey);
    if (existingWorker) {
      this.logger.warn(`Worker for queue ${queueName} already exists, replacing`);
      existingWorker.close();
    }

    const worker = new Worker<T>(
      queueName as string,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.workers.set(queueKey, worker as any);
    return worker;
  }

  /**
   * Get job by ID
   */
  async getJob<T extends JobData>(
    queueName: QueueName | string,
    jobId: string
  ): Promise<Job<T> | undefined> {
    const queue = this.getQueue(queueName);
    return queue.getJob(jobId) as Promise<Job<T> | undefined>;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: QueueName | string): Promise<{
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
  async clearQueue(queueName: QueueName | string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.drain();
    this.logger.log(`Queue ${queueName} cleared`);
  }

  /**
   * Retry failed jobs
   */
  async retryFailedJobs(queueName: QueueName | string): Promise<number> {
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
    return this.addJob(QueueName.EMAIL, `email:${job.type}`, job, options);
  }

  /**
   * Queue a webhook delivery
   */
  async queueWebhook(
    job: WebhookJob,
    options?: JobsOptions
  ): Promise<Job<WebhookJob>> {
    return this.addJob(QueueName.WEBHOOK, `webhook:${job.event}`, job, {
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
    return this.addJob(QueueName.ANALYTICS, `analytics:${job.type}`, job, options);
  }

  /**
   * Queue a billing operation
   */
  async queueBilling(
    job: BillingJob,
    options?: JobsOptions
  ): Promise<Job<BillingJob>> {
    return this.addJob(QueueName.BILLING, `billing:${job.type}`, job, options);
  }
}
