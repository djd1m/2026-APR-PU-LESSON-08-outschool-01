import { Job, Worker } from 'bullmq';
import { QUEUES } from '../queues';

interface NotificationJobData {
  type: 'class-reminder' | 'child-joined' | 'new-review' | 'payout-complete' | 'enrollment-confirmed';
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

async function processNotification(job: Job<NotificationJobData>): Promise<void> {
  const { type, userId, title, body } = job.data;

  // TODO: Integrate with push notification service (Firebase FCM or similar)
  console.log(`[notification] Sending ${type} to user ${userId}: ${title}`);

  // Placeholder: log notification
  // In production: send via FCM/APNs, store in DB for in-app notifications
  console.log(`[notification] Delivered to ${userId}`);
}

export function createNotificationWorker(connectionUrl: string) {
  return new Worker(QUEUES.NOTIFICATION, processNotification, {
    connection: { url: connectionUrl },
    concurrency: 10,
  });
}
