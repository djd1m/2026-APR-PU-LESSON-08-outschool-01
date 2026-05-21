import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUES } from './queues';
import { processEmailJob } from './processors/email.processor';
import { processSearchSyncJob } from './processors/search-sync.processor';
import { processPayoutJob } from './processors/payout.processor';
import { processNotificationJob } from './processors/notification.processor';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function createConnection(): IORedis {
  const connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  connection.on('error', (err) => {
    console.error('[redis] connection error:', err.message);
  });

  connection.on('connect', () => {
    console.log('[redis] connected to', REDIS_URL);
  });

  return connection;
}

function startWorkers(connection: IORedis): Worker[] {
  const workers: Worker[] = [];

  // Email worker
  const emailWorker = new Worker(QUEUES.EMAIL, processEmailJob, {
    connection,
    concurrency: 5,
    limiter: { max: 10, duration: 1000 },
  });
  emailWorker.on('completed', (job) => {
    console.log(`[${QUEUES.EMAIL}] job ${job.id} completed`);
  });
  emailWorker.on('failed', (job, err) => {
    console.error(`[${QUEUES.EMAIL}] job ${job?.id} failed:`, err.message);
  });
  workers.push(emailWorker);

  // Search sync worker
  const searchSyncWorker = new Worker(QUEUES.SEARCH_SYNC, processSearchSyncJob, {
    connection,
    concurrency: 3,
  });
  searchSyncWorker.on('completed', (job) => {
    console.log(`[${QUEUES.SEARCH_SYNC}] job ${job.id} completed`);
  });
  searchSyncWorker.on('failed', (job, err) => {
    console.error(`[${QUEUES.SEARCH_SYNC}] job ${job?.id} failed:`, err.message);
  });
  workers.push(searchSyncWorker);

  // Payout worker
  const payoutWorker = new Worker(QUEUES.PAYOUT, processPayoutJob, {
    connection,
    concurrency: 1,
    limiter: { max: 5, duration: 60_000 },
  });
  payoutWorker.on('completed', (job) => {
    console.log(`[${QUEUES.PAYOUT}] job ${job.id} completed`);
  });
  payoutWorker.on('failed', (job, err) => {
    console.error(`[${QUEUES.PAYOUT}] job ${job?.id} failed:`, err.message);
  });
  workers.push(payoutWorker);

  // Notification worker
  const notificationWorker = new Worker(
    QUEUES.NOTIFICATION,
    processNotificationJob,
    { connection, concurrency: 10 },
  );
  notificationWorker.on('completed', (job) => {
    console.log(`[${QUEUES.NOTIFICATION}] job ${job.id} completed`);
  });
  notificationWorker.on('failed', (job, err) => {
    console.error(`[${QUEUES.NOTIFICATION}] job ${job?.id} failed:`, err.message);
  });
  workers.push(notificationWorker);

  return workers;
}

async function main() {
  console.log('[workers] starting...');

  const connection = createConnection();
  const workers = startWorkers(connection);

  console.log(
    `[workers] ${workers.length} workers registered:`,
    Object.values(QUEUES).join(', '),
  );

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[workers] received ${signal}, shutting down gracefully...`);

    await Promise.all(workers.map((w) => w.close()));
    await connection.quit();

    console.log('[workers] shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[workers] fatal error:', err);
  process.exit(1);
});
