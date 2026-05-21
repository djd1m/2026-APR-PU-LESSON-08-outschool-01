export const QUEUES = {
  EMAIL: 'email',
  SEARCH_SYNC: 'search-sync',
  PAYOUT: 'payout',
  NOTIFICATION: 'notification',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

// ----- Email job types -----

export type EmailJobType =
  | 'welcome'
  | 'booking-confirmation'
  | 'class-reminder'
  | 'payout-complete'
  | 'section-cancelled';

export interface EmailJobData {
  type: EmailJobType;
  to: string;
  payload: Record<string, unknown>;
}

// ----- Search sync job types -----

export type SearchSyncAction = 'upsert' | 'delete';

export interface SearchSyncJobData {
  action: SearchSyncAction;
  classId: string;
  data?: {
    title: string;
    description: string;
    subject: string;
    teacherName: string;
    ageMin: number;
    ageMax: number;
    priceFrom: number;
    rating: number;
  };
}

// ----- Payout job types -----

export interface PayoutJobData {
  teacherId: string;
  amount: number;
  currency: 'RUB';
  payoutMethod: 'bank_card' | 'yookassa';
  idempotencyKey: string;
}

// ----- Notification job types -----

export type NotificationChannel = 'push' | 'in-app';

export interface NotificationJobData {
  userId: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}
