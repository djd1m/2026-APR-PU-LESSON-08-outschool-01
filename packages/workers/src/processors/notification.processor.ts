import { Job } from 'bullmq';
import type { NotificationJobData } from '../queues';

// Firebase FCM configuration (placeholder)
const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY || '';
const FCM_URL = 'https://fcm.googleapis.com/fcm/send';

interface DeviceToken {
  userId: string;
  token: string;
  platform: 'android' | 'ios' | 'web';
}

async function getUserDeviceTokens(userId: string): Promise<DeviceToken[]> {
  // In production: query database for user's registered device tokens
  // For now, return empty array (no push notifications in dev)
  console.log(`[notification] looking up device tokens for user ${userId}`);
  return [];
}

async function sendPushNotification(
  token: DeviceToken,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!FCM_SERVER_KEY) {
    console.log(
      `[notification] DEV MODE: push to ${token.platform} device for user ${token.userId}: "${title}"`,
    );
    return;
  }

  const response = await fetch(FCM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `key=${FCM_SERVER_KEY}`,
    },
    body: JSON.stringify({
      to: token.token,
      notification: { title, body },
      data: data || {},
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FCM error ${response.status}: ${text}`);
  }
}

async function storeInAppNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  // In production: insert into notifications table in database
  console.log(
    `[notification] stored in-app notification for user ${userId}: "${title}"`,
  );

  // Placeholder — would call something like:
  // await db.notification.create({ userId, title, body, data, read: false });
}

export async function processNotificationJob(
  job: Job<NotificationJobData>,
): Promise<void> {
  const { userId, channel, title, body, data } = job.data;

  console.log(
    `[notification] processing ${channel} notification for user ${userId}: "${title}"`,
  );

  switch (channel) {
    case 'push': {
      const tokens = await getUserDeviceTokens(userId);
      if (tokens.length === 0) {
        console.log(
          `[notification] no device tokens for user ${userId}, falling back to in-app`,
        );
        await storeInAppNotification(userId, title, body, data);
        return;
      }

      await Promise.allSettled(
        tokens.map((token) => sendPushNotification(token, title, body, data)),
      );
      break;
    }

    case 'in-app': {
      await storeInAppNotification(userId, title, body, data);
      break;
    }

    default: {
      const _exhaustive: never = channel;
      throw new Error(`Unknown notification channel: ${_exhaustive}`);
    }
  }

  console.log(`[notification] delivered ${channel} notification to user ${userId}`);
}
