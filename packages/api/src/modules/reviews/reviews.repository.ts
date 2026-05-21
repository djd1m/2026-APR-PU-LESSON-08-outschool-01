import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReviewsRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.ReviewCreateInput) {
    return this.prisma.review.create({
      data,
      include: { enrollment: true },
    });
  }

  async findById(id: string) {
    return this.prisma.review.findUnique({
      where: { id },
      include: { enrollment: { include: { child: true } } },
    });
  }

  async findByEnrollmentId(enrollmentId: string) {
    return this.prisma.review.findUnique({ where: { enrollmentId } });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    where?: Prisma.ReviewWhereInput;
  }) {
    const { skip = 0, take = 20, where } = params;
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        skip,
        take,
        where,
        orderBy: { createdAt: 'desc' },
        include: { enrollment: { include: { child: true, section: { include: { class: true } } } } },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, total };
  }

  async findFlagged(params: { skip?: number; take?: number }) {
    const { skip = 0, take = 20 } = params;
    const where: Prisma.ReviewWhereInput = { flagged: true };
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        skip,
        take,
        where,
        orderBy: { createdAt: 'desc' },
        include: { enrollment: { include: { child: true, section: { include: { class: true } } } } },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, total };
  }

  async delete(id: string) {
    return this.prisma.review.delete({ where: { id } });
  }

  async update(id: string, data: Prisma.ReviewUpdateInput) {
    return this.prisma.review.update({
      where: { id },
      data,
      include: { enrollment: { include: { child: true } } },
    });
  }

  async getAverageRatingForTeacher(teacherId: string) {
    const result = await this.prisma.review.aggregate({
      _avg: { rating: true },
      _count: { rating: true },
      where: {
        enrollment: {
          section: {
            class: { teacherId },
          },
        },
      },
    });
    return {
      average: result._avg.rating ?? 0,
      count: result._count.rating,
    };
  }
}
