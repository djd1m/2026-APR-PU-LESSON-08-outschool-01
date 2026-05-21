import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentsRepository } from './payments.repository';
import { COMMISSION_RATE } from '@klassmarket/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  constructor(
    private paymentsRepository: PaymentsRepository,
    private prisma: PrismaService,
  ) {}

  async createForEnrollment(enrollmentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { section: { include: { class: true } } },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    // CRITICAL: Use Decimal for ALL money calculations — never float
    const amount = new Prisma.Decimal(enrollment.section.class.price.toString());
    const commission = amount.mul(new Prisma.Decimal(COMMISSION_RATE.toString()));
    const teacherPayout = amount.sub(commission);

    return this.paymentsRepository.create({
      amount,
      commission,
      teacherPayout,
      enrollment: { connect: { id: enrollmentId } },
    });
  }

  async findById(id: string) {
    const payment = await this.paymentsRepository.findById(id);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  /**
   * Verify ЮKassa webhook HMAC-SHA256 signature.
   * Rejects unsigned/forged webhooks.
   */
  verifyWebhookSignature(body: string, signature: string | undefined): boolean {
    const secret = process.env.YOOKASSA_SECRET_KEY;
    if (!secret) {
      // In dev without credentials — log warning, allow
      if (process.env.NODE_ENV === 'development') {
        console.warn('[payments] YOOKASSA_SECRET_KEY not set — skipping HMAC in dev');
        return true;
      }
      throw new BadRequestException('Webhook secret not configured');
    }
    if (!signature) {
      throw new BadRequestException('Missing webhook signature');
    }
    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  async handleWebhook(rawBody: string, signature: string | undefined, yookassaId: string, status: string) {
    // CRITICAL: Verify HMAC before processing
    if (!this.verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Idempotency: check if already processed
    const existing = await this.paymentsRepository.findByYookassaId(yookassaId);
    if (!existing) {
      throw new NotFoundException('Payment not found');
    }

    // Skip if already in terminal state (idempotent)
    if (existing.status === 'COMPLETED' || existing.status === 'REFUNDED') {
      return { received: true, status: 'already_processed' };
    }

    if (status === 'succeeded') {
      await this.paymentsRepository.update(existing.id, {
        status: 'COMPLETED',
        paidAt: new Date(),
      });

      await this.prisma.enrollment.update({
        where: { id: existing.enrollmentId },
        data: { status: 'CONFIRMED' },
      });
    } else if (status === 'canceled') {
      await this.paymentsRepository.update(existing.id, {
        status: 'REFUNDED',
        refundedAt: new Date(),
      });
    }

    return { received: true };
  }

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
}
