import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PaymentsRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.PaymentCreateInput) {
    return this.prisma.payment.create({
      data,
      include: { enrollment: true },
    });
  }

  async findById(id: string) {
    return this.prisma.payment.findUnique({
      where: { id },
      include: {
        enrollment: {
          include: {
            child: true,
            section: { include: { class: { include: { teacher: true } } } },
          },
        },
      },
    });
  }

  async findByYookassaId(yookassaId: string) {
    return this.prisma.payment.findUnique({
      where: { yookassaId },
    });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    where?: Prisma.PaymentWhereInput;
  }) {
    const { skip = 0, take = 20, where } = params;
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        skip,
        take,
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          enrollment: {
            include: {
              child: true,
              section: { include: { class: true } },
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items, total };
  }

  async update(id: string, data: Prisma.PaymentUpdateInput) {
    return this.prisma.payment.update({ where: { id }, data });
  }

  /**
   * Aggregate teacher earnings from completed payments.
   * Returns totals using Decimal to avoid floating-point errors.
   */
  async getTeacherEarnings(teacherUserId: string): Promise<{
    totalEarned: Decimal;
    pendingPayout: Decimal;
    withdrawn: Decimal;
  }> {
    // Find all completed payments for classes taught by this teacher
    const completedPayments = await this.prisma.payment.findMany({
      where: {
        status: 'COMPLETED',
        enrollment: {
          section: {
            class: {
              teacher: {
                userId: teacherUserId,
              },
            },
          },
        },
      },
      select: {
        teacherPayout: true,
      },
    });

    const totalEarned = completedPayments.reduce(
      (sum, p) => sum.add(p.teacherPayout),
      new Decimal(0),
    );

    // For now, withdrawn is tracked externally via payout jobs.
    // We return totalEarned as pendingPayout and 0 as withdrawn.
    // A real implementation would track withdrawals in a separate table.
    const withdrawn = new Decimal(0);
    const pendingPayout = totalEarned.sub(withdrawn);

    return { totalEarned, pendingPayout, withdrawn };
  }

  /**
   * Find payments belonging to a parent (via their children's enrollments).
   */
  async findByParent(parentId: string, params: { skip?: number; take?: number }) {
    const { skip = 0, take = 20 } = params;
    const where: Prisma.PaymentWhereInput = {
      enrollment: {
        child: {
          parentId,
        },
      },
    };

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        skip,
        take,
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          enrollment: {
            include: {
              child: true,
              section: { include: { class: true } },
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { items, total };
  }
}
