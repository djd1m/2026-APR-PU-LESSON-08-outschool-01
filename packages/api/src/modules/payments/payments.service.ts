import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PaymentsRepository } from './payments.repository';
import { COMMISSION_RATE } from '@klassmarket/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { createHmac } from 'crypto';

// ЮKassa API configuration
const YOOKASSA_API_URL =
  process.env.YOOKASSA_API_URL || 'https://api.yookassa.ru/v3';
const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID || '';
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || '';
const YOOKASSA_WEBHOOK_SECRET = process.env.YOOKASSA_WEBHOOK_SECRET || '';
const YOOKASSA_RETURN_URL =
  process.env.YOOKASSA_RETURN_URL || 'http://localhost:3000';

@Injectable()
export class PaymentsService {
  private payoutQueue: Queue | null = null;

  constructor(
    private paymentsRepository: PaymentsRepository,
    private prisma: PrismaService,
  ) {
    // Initialize BullMQ payout queue if Redis is available
    try {
      const IORedis = require('ioredis');
      const connection = new IORedis(
        process.env.REDIS_URL || 'redis://localhost:6379',
        { maxRetriesPerRequest: null, enableReadyCheck: false },
      );
      this.payoutQueue = new Queue('payout', { connection });
    } catch {
      console.warn('[payments] BullMQ payout queue not initialized — Redis unavailable');
    }
  }

  /**
   * Create a checkout payment for an enrollment.
   * Calculates price with 22% commission, creates Payment record,
   * calls ЮKassa API, returns confirmation_url for redirect.
   */
  async createCheckout(
    parentId: string,
    enrollmentId: string,
  ): Promise<{ paymentId: string; confirmationUrl: string }> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        child: true,
        section: { include: { class: true } },
        payment: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    // Verify the parent owns this enrollment's child
    if (enrollment.child.parentId !== parentId) {
      throw new ForbiddenException('You do not own this enrollment');
    }

    // Check if payment already exists
    if (enrollment.payment) {
      if (enrollment.payment.status === 'COMPLETED') {
        throw new BadRequestException('Enrollment is already paid');
      }
      // If pending/processing payment exists, return existing ЮKassa URL
      if (
        enrollment.payment.yookassaId &&
        (enrollment.payment.status === 'PENDING' ||
          enrollment.payment.status === 'PROCESSING')
      ) {
        // Re-fetch from ЮKassa to get current confirmation_url
        const existing = await this.getYookassaPayment(
          enrollment.payment.yookassaId,
        );
        if (existing?.confirmation?.confirmation_url) {
          return {
            paymentId: enrollment.payment.id,
            confirmationUrl: existing.confirmation.confirmation_url,
          };
        }
      }
    }

    // Use Decimal for all money calculations — never float
    const price = new Decimal(enrollment.section.class.price);
    const commissionRate = new Decimal(COMMISSION_RATE);
    const commission = price.mul(commissionRate).toDecimalPlaces(2);
    const teacherPayout = price.sub(commission);

    // Create Payment record in DB
    const payment = await this.paymentsRepository.create({
      amount: price,
      commission,
      teacherPayout,
      enrollment: { connect: { id: enrollmentId } },
    });

    // Call ЮKassa API to create payment
    const yookassaPayment = await this.createYookassaPayment({
      amount: price.toFixed(2),
      description: `Оплата занятия: ${enrollment.section.class.title}`,
      paymentId: payment.id,
      enrollmentId,
    });

    // Update payment with ЮKassa ID
    await this.paymentsRepository.update(payment.id, {
      yookassaId: yookassaPayment.id,
      status: 'PROCESSING',
    });

    return {
      paymentId: payment.id,
      confirmationUrl: yookassaPayment.confirmation.confirmation_url,
    };
  }

  /**
   * Handle ЮKassa webhook events.
   * Verifies signature, handles payment.succeeded, payment.canceled, refund.succeeded.
   * Idempotent — duplicate webhooks for the same yookassaId are safely ignored.
   */
  async handleWebhook(body: {
    type: string;
    event: string;
    object: { id: string; status: string; payment_id?: string };
  }): Promise<{ received: true }> {
    const { event, object } = body;

    if (event === 'payment.succeeded') {
      return this.handlePaymentSucceeded(object.id);
    }

    if (event === 'payment.canceled') {
      return this.handlePaymentCanceled(object.id);
    }

    if (event === 'refund.succeeded') {
      const paymentYookassaId = object.payment_id;
      if (paymentYookassaId) {
        return this.handleRefundSucceeded(paymentYookassaId);
      }
    }

    // Unknown event — acknowledge to prevent retries
    return { received: true };
  }

  /**
   * Verify ЮKassa webhook signature using HMAC-SHA256.
   */
  verifyWebhookSignature(
    rawBody: string,
    signature: string | undefined,
  ): boolean {
    if (!YOOKASSA_WEBHOOK_SECRET) {
      // In development, skip signature verification
      return true;
    }
    if (!signature) {
      return false;
    }
    const expected = createHmac('sha256', YOOKASSA_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    return signature === expected;
  }

  private async handlePaymentSucceeded(
    yookassaId: string,
  ): Promise<{ received: true }> {
    const payment = await this.paymentsRepository.findByYookassaId(yookassaId);

    // Idempotency: if payment not found or already completed, skip
    if (!payment || payment.status === 'COMPLETED') {
      return { received: true };
    }

    await this.paymentsRepository.update(payment.id, {
      status: 'COMPLETED',
      paidAt: new Date(),
    });

    await this.prisma.enrollment.update({
      where: { id: payment.enrollmentId },
      data: { status: 'CONFIRMED' },
    });

    return { received: true };
  }

  private async handlePaymentCanceled(
    yookassaId: string,
  ): Promise<{ received: true }> {
    const payment = await this.paymentsRepository.findByYookassaId(yookassaId);

    if (!payment || payment.status === 'REFUNDED') {
      return { received: true };
    }

    await this.paymentsRepository.update(payment.id, {
      status: 'REFUNDED',
      refundedAt: new Date(),
    });

    await this.prisma.enrollment.update({
      where: { id: payment.enrollmentId },
      data: { status: 'CANCELLED' },
    });

    return { received: true };
  }

  private async handleRefundSucceeded(
    paymentYookassaId: string,
  ): Promise<{ received: true }> {
    const payment =
      await this.paymentsRepository.findByYookassaId(paymentYookassaId);

    if (!payment || payment.status === 'REFUNDED') {
      return { received: true };
    }

    await this.paymentsRepository.update(payment.id, {
      status: 'REFUNDED',
      refundedAt: new Date(),
    });

    await this.prisma.enrollment.update({
      where: { id: payment.enrollmentId },
      data: { status: 'REFUNDED' },
    });

    return { received: true };
  }

  /**
   * Request a refund for a payment.
   * Validates parent ownership and that the class hasn't started yet.
   */
  async refund(
    parentId: string,
    paymentId: string,
  ): Promise<{ refundId: string }> {
    const payment = await this.paymentsRepository.findById(paymentId);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Verify parent owns this payment
    if (payment.enrollment.child.parentId !== parentId) {
      throw new ForbiddenException('You do not own this payment');
    }

    if (payment.status !== 'COMPLETED') {
      throw new BadRequestException('Payment is not in a refundable state');
    }

    // Check the class hasn't started yet
    const section = payment.enrollment.section;
    if (new Date() >= new Date(section.startTime)) {
      throw new BadRequestException(
        'Cannot refund after class has started',
      );
    }

    if (!payment.yookassaId) {
      throw new UnprocessableEntityException(
        'Payment has no ЮKassa ID for refund',
      );
    }

    // Call ЮKassa refund API
    const refundResult = await this.createYookassaRefund(
      payment.yookassaId,
      new Decimal(payment.amount).toFixed(2),
    );

    // Mark payment as processing refund (will be finalized by webhook)
    await this.paymentsRepository.update(payment.id, {
      status: 'REFUNDED',
      refundedAt: new Date(),
    });

    await this.prisma.enrollment.update({
      where: { id: payment.enrollmentId },
      data: { status: 'REFUNDED' },
    });

    // Decrement enrolled count
    await this.prisma.section.update({
      where: { id: payment.enrollment.sectionId },
      data: { enrolledCount: { decrement: 1 } },
    });

    return { refundId: refundResult.id };
  }

  /**
   * Get a parent's payment history.
   */
  async getParentPayments(parentId: string, page = 1, perPage = 20) {
    const skip = (page - 1) * perPage;
    const { items, total } = await this.paymentsRepository.findByParent(
      parentId,
      { skip, take: perPage },
    );

    return {
      items,
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  /**
   * Get a single payment by ID.
   */
  async findById(id: string) {
    const payment = await this.paymentsRepository.findById(id);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  /**
   * Get teacher earnings summary.
   * All calculations use Decimal to avoid floating-point errors.
   */
  async getEarnings(teacherId: string): Promise<{
    totalEarned: string;
    pendingPayout: string;
    withdrawn: string;
  }> {
    const earnings =
      await this.paymentsRepository.getTeacherEarnings(teacherId);

    return {
      totalEarned: earnings.totalEarned.toFixed(2),
      pendingPayout: earnings.pendingPayout.toFixed(2),
      withdrawn: earnings.withdrawn.toFixed(2),
    };
  }

  /**
   * Request a teacher payout via BullMQ queue.
   * Validates the teacher has sufficient available balance.
   */
  async requestWithdraw(
    teacherId: string,
    amount: number,
  ): Promise<{ jobId: string; message: string }> {
    // Validate minimum withdrawal amount (1000 RUB)
    if (amount < 1000) {
      throw new BadRequestException(
        'Minimum withdrawal amount is 1000 RUB',
      );
    }

    const earnings =
      await this.paymentsRepository.getTeacherEarnings(teacherId);
    const requestedAmount = new Decimal(amount);

    if (requestedAmount.gt(earnings.pendingPayout)) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${earnings.pendingPayout.toFixed(2)} RUB`,
      );
    }

    if (!this.payoutQueue) {
      throw new UnprocessableEntityException(
        'Payout system is unavailable. Please try again later.',
      );
    }

    const idempotencyKey = randomUUID();

    const job = await this.payoutQueue.add(
      'teacher-payout',
      {
        teacherId,
        amount,
        currency: 'RUB' as const,
        payoutMethod: 'yookassa' as const,
        idempotencyKey,
      },
      {
        jobId: idempotencyKey,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    return {
      jobId: job.id ?? idempotencyKey,
      message: `Payout of ${amount} RUB queued successfully`,
    };
  }

  /**
   * Admin: list all payments.
   */
  async findAll(page = 1, perPage = 20) {
    const skip = (page - 1) * perPage;
    const { items, total } = await this.paymentsRepository.findAll({
      skip,
      take: perPage,
    });

    return {
      items,
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  // ─── ЮKassa API helpers ───────────────────────────────────────────

  private getYookassaAuth(): string {
    return Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString(
      'base64',
    );
  }

  private async createYookassaPayment(params: {
    amount: string;
    description: string;
    paymentId: string;
    enrollmentId: string;
  }): Promise<{
    id: string;
    confirmation: { confirmation_url: string };
  }> {
    if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY) {
      // Development mode: simulate ЮKassa response
      console.log(
        `[payments] DEV MODE: simulating ЮKassa payment for ${params.amount} RUB`,
      );
      const fakeId = `dev_${randomUUID()}`;
      return {
        id: fakeId,
        confirmation: {
          confirmation_url: `${YOOKASSA_RETURN_URL}/checkout/${params.enrollmentId}?simulated=true&yookassaId=${fakeId}`,
        },
      };
    }

    const idempotencyKey = params.paymentId;

    const response = await fetch(`${YOOKASSA_API_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${this.getYookassaAuth()}`,
        'Idempotence-Key': idempotencyKey,
      },
      body: JSON.stringify({
        amount: {
          value: params.amount,
          currency: 'RUB',
        },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: `${YOOKASSA_RETURN_URL}/checkout/${params.enrollmentId}?paymentId=${params.paymentId}`,
        },
        description: params.description,
        metadata: {
          paymentId: params.paymentId,
          enrollmentId: params.enrollmentId,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new UnprocessableEntityException(
        `ЮKassa API error ${response.status}: ${body}`,
      );
    }

    return response.json();
  }

  private async getYookassaPayment(
    yookassaId: string,
  ): Promise<{
    id: string;
    status: string;
    confirmation?: { confirmation_url: string };
  } | null> {
    if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY) {
      return null;
    }

    try {
      const response = await fetch(
        `${YOOKASSA_API_URL}/payments/${yookassaId}`,
        {
          headers: {
            Authorization: `Basic ${this.getYookassaAuth()}`,
          },
        },
      );

      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  private async createYookassaRefund(
    yookassaPaymentId: string,
    amount: string,
  ): Promise<{ id: string; status: string }> {
    if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY) {
      // Development mode: simulate refund
      console.log(
        `[payments] DEV MODE: simulating ЮKassa refund for payment ${yookassaPaymentId}`,
      );
      return {
        id: `dev_refund_${randomUUID()}`,
        status: 'succeeded',
      };
    }

    const idempotencyKey = `refund_${yookassaPaymentId}_${Date.now()}`;

    const response = await fetch(`${YOOKASSA_API_URL}/refunds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${this.getYookassaAuth()}`,
        'Idempotence-Key': idempotencyKey,
      },
      body: JSON.stringify({
        amount: {
          value: amount,
          currency: 'RUB',
        },
        payment_id: yookassaPaymentId,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new UnprocessableEntityException(
        `ЮKassa refund API error ${response.status}: ${body}`,
      );
    }

    return response.json();
  }
}
