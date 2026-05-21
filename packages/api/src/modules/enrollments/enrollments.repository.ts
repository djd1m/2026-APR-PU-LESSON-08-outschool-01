import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class EnrollmentsRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.EnrollmentCreateInput) {
    return this.prisma.enrollment.create({
      data,
      include: { child: true, section: { include: { class: true } } },
    });
  }

  async findById(id: string) {
    return this.prisma.enrollment.findUnique({
      where: { id },
      include: {
        child: true,
        section: { include: { class: true } },
        payment: true,
      },
    });
  }

  async findByChildAndSection(childId: string, sectionId: string) {
    return this.prisma.enrollment.findUnique({
      where: { childId_sectionId: { childId, sectionId } },
    });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    where?: Prisma.EnrollmentWhereInput;
  }) {
    const { skip = 0, take = 20, where } = params;
    const [items, total] = await Promise.all([
      this.prisma.enrollment.findMany({
        skip,
        take,
        where,
        orderBy: { createdAt: 'desc' },
        include: { child: true, section: { include: { class: true } } },
      }),
      this.prisma.enrollment.count({ where }),
    ]);
    return { items, total };
  }

  async update(id: string, data: Prisma.EnrollmentUpdateInput) {
    return this.prisma.enrollment.update({ where: { id }, data });
  }
}
