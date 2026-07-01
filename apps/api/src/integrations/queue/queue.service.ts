import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, type ConnectionOptions, type Processor } from 'bullmq';

/** Named queues used across the app. Swap BullMQ for SQS in production. */
export const QUEUES = {
  EMBEDDINGS: 'embeddings',
  NOTIFICATIONS: 'notifications',
  REMINDERS: 'reminders',
} as const;

/**
 * Thin BullMQ wrapper acting as the event queue (Kafka/SQS stand-in).
 * We hand BullMQ a plain connection-options object (parsed from REDIS_URL) and
 * let it manage its own ioredis client — this avoids cross-version ioredis type
 * clashes and keeps enqueue best-effort so the API keeps working if Redis is down.
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private _connection?: ConnectionOptions;
  private readonly queues = new Map<string, Queue>();
  private readonly workers: Worker[] = [];

  constructor(private readonly config: ConfigService) {}

  private get connection(): ConnectionOptions {
    if (!this._connection) {
      const url = new URL(this.config.get<string>('redisUrl') ?? 'redis://localhost:6379');
      this._connection = {
        host: url.hostname,
        port: url.port ? Number(url.port) : 6379,
        username: url.username || undefined,
        password: url.password || undefined,
        db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined,
        maxRetriesPerRequest: null,
      };
    }
    return this._connection;
  }

  getQueue(name: string): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, { connection: this.connection });
      this.queues.set(name, queue);
    }
    return queue;
  }

  async enqueue<T extends object>(queueName: string, jobName: string, data: T, delayMs?: number): Promise<void> {
    try {
      await this.getQueue(queueName).add(jobName, data, delayMs ? { delay: delayMs } : undefined);
    } catch (err) {
      this.logger.warn(`Enqueue failed (${queueName}/${jobName}): ${(err as Error).message}`);
    }
  }

  registerWorker<T>(queueName: string, processor: Processor<T>): Worker<T> {
    const worker = new Worker<T>(queueName, processor, { connection: this.connection });
    worker.on('failed', (job, err) => this.logger.error(`Job ${job?.id} failed: ${err.message}`));
    this.workers.push(worker as unknown as Worker);
    return worker;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close())).catch(() => undefined);
    await Promise.all([...this.queues.values()].map((q) => q.close())).catch(() => undefined);
  }
}
