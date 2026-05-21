import { Job } from 'bullmq';
import type { PayoutJobData } from '../queues';

// YooKassa Payout API configuration
const YOOKASSA_PAYOUT_URL =
  process.env.YOOKASSA_PAYOUT_URL || 'https://api.yookassa.ru/v3/payouts';
const YOOKASSA_AGENT_ID = process.env.YOOKASSA_AGENT_ID || '';
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || '';

interface PayoutResult {
  payoutId: string;
  status: 'succeeded' | 'pending' | 'canceled';
  amount: number;
}

async function createYookassaPayout(
  data: PayoutJobData,
): Promise<PayoutResult> {
  if (!YOOKASSA_AGENT_ID || !YOOKASSA_SECRET_KEY) {
    // In development, simulate a successful payout
    console.log(
      `[payout] DEV MODE: simulating payout of ${data.amount} RUB to teacher ${data.teacherId}`,
    );
    return {
      payoutId: `dev_${data.idempotencyKey}`,
      status: 'succeeded',
      amount: data.amount,
    };
  }

  const auth = Buffer.from(
    `${YOOKASSA_AGENT_ID}:${YOOKASSA_SECRET_KEY}`,
  ).toString('base64');

  const response = await fetch(YOOKASSA_PAYOUT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
      'Idempotence-Key': data.idempotencyKey,
    },
    body: JSON.stringify({
      amount: {
        value: data.amount.toFixed(2),
        currency: data.currency,
      },
      payout_destination_data: {
        type: data.payoutMethod === 'bank_card' ? 'bank_card' : 'yoo_money',
      },
      description: `Payout to teacher ${data.teacherId}`,
      metadata: {
        teacherId: data.teacherId,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`YooKassa payout API error ${response.status}: ${body}`);
  }

  const result = await response.json();

  return {
    payoutId: result.id,
    status: result.status,
    amount: parseFloat(result.amount.value),
  };
}

export async function processPayoutJob(
  job: Job<PayoutJobData>,
): Promise<void> {
  const { teacherId, amount, idempotencyKey } = job.data;

  console.log(
    `[payout] processing payout: ${amount} RUB to teacher ${teacherId} (key: ${idempotencyKey})`,
  );

  const result = await createYookassaPayout(job.data);

  if (result.status === 'canceled') {
    throw new Error(
      `Payout ${result.payoutId} was canceled by payment provider`,
    );
  }

  console.log(
    `[payout] payout ${result.payoutId} status: ${result.status}, amount: ${result.amount} RUB`,
  );

  // Update job progress for monitoring
  await job.updateProgress({
    payoutId: result.payoutId,
    status: result.status,
  });
}
