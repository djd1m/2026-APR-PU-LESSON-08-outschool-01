import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentsRepository } from './payments.repository';
import { COMMISSION_RATE } from '@klassmarket/shared';
import { PrismaService } from '../../prisma/prisma.service';

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

    const amount = Number(enrollment.section.class.price);
    const commission = Math.round(amount * COMMISSION_RATE * 100) / 100;
    const teacherPayout = amount - commission;

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

  async handleWebhook(yookassaId: string, status: string) {
    const payment = await this.paymentsRepository.findByYookassaId(yookassaId);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (status === 'succeeded') {
      await this.paymentsRepository.update(payment.id, {
        status: 'COMPLETED',
        paidAt: new Date(),
      });

      await this.prisma.enrollment.update({
        where: { id: payment.enrollmentId },
        data: { status: 'CONFIRMED' },
      });
    } else if (status === 'canceled') {
      await this.paymentsRepository.update(payment.id, {
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
