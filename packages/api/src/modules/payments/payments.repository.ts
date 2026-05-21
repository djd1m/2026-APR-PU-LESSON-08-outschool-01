import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

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
      include: { enrollment: { include: { child: true, section: { include: { class: true } } } } },
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
        include: { enrollment: true },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items, total };
  }

  async update(id: string, data: Prisma.PaymentUpdateInput) {
    return this.prisma.payment.update({ where: { id }, data });
  }
}
