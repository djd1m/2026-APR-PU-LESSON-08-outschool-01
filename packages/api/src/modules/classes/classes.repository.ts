import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ClassSortOption } from './dto/class-filter.dto';

export interface FindAllParams {
  skip?: number;
  take?: number;
  cursor?: string;
  where?: Prisma.ClassWhereInput;
  orderBy?: Prisma.ClassOrderByWithRelationInput;
  sort?: ClassSortOption;
}

@Injectable()
export class ClassesRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.ClassCreateInput) {
    return this.prisma.class.create({ data, include: { teacher: true } });
  }

  async findById(id: string) {
    return this.prisma.class.findUnique({
      where: { id },
      include: {
        teacher: {
          include: {
            user: true,
            _count: { select: { classes: true } },
          },
        },
        sections: {
          where: {
            startTime: { gte: new Date() },
            status: 'SCHEDULED',
          },
          orderBy: { startTime: 'asc' },
          take: 10,
        },
        reviews: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: {
          select: { reviews: true, sections: true },
        },
      },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.class.findUnique({
      where: { slug },
      include: {
        teacher: {
          include: {
            user: true,
            _count: { select: { classes: true } },
          },
        },
        sections: {
          where: {
            startTime: { gte: new Date() },
            status: 'SCHEDULED',
          },
          orderBy: { startTime: 'asc' },
          take: 10,
        },
        reviews: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: {
          select: { reviews: true, sections: true },
        },
      },
    });
  }

  async findAll(params: FindAllParams) {
    const { skip = 0, take = 20, cursor, where, sort } = params;

    const orderBy = this.buildOrderBy(sort);

    const cursorClause = cursor ? { cursor: { id: cursor }, skip: 1 } : {};

    const [items, total] = await Promise.all([
      this.prisma.class.findMany({
        ...(cursor ? cursorClause : { skip }),
        take,
        where,
        orderBy,
        include: {
          teacher: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            },
          },
          _count: {
            select: { reviews: true, sections: true },
          },
        },
      }),
      this.prisma.class.count({ where }),
    ]);

    return { items, total };
  }

  async getDistinctSubjects(): Promise<string[]> {
    const results = await this.prisma.class.findMany({
      where: { status: 'PUBLISHED' },
      select: { subject: true },
      distinct: ['subject'],
      orderBy: { subject: 'asc' },
    });
    return results.map((r) => r.subject);
  }

  async getAverageRating(classId: string): Promise<{ avg: number; count: number }> {
    const result = await this.prisma.review.aggregate({
      where: { classId },
      _avg: { rating: true },
      _count: { rating: true },
    });
    return {
      avg: result._avg.rating ?? 0,
      count: result._count.rating,
    };
  }

  async update(id: string, data: Prisma.ClassUpdateInput) {
    return this.prisma.class.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.class.delete({ where: { id } });
  }

  private buildOrderBy(sort?: ClassSortOption): Prisma.ClassOrderByWithRelationInput {
    switch (sort) {
      case 'price_asc':
        return { price: 'asc' };
      case 'price_desc':
        return { price: 'desc' };
      case 'rating':
        return { reviews: { _count: 'desc' } };
      case 'newest':
      default:
        return { createdAt: 'desc' };
    }
  }
}
