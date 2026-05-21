import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ClassesRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.ClassCreateInput) {
    return this.prisma.class.create({ data, include: { teacher: true } });
  }

  async findById(id: string) {
    return this.prisma.class.findUnique({
      where: { id },
      include: { teacher: { include: { user: true } }, sections: true },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.class.findUnique({
      where: { slug },
      include: { teacher: { include: { user: true } }, sections: true },
    });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    where?: Prisma.ClassWhereInput;
    orderBy?: Prisma.ClassOrderByWithRelationInput;
  }) {
    const { skip = 0, take = 20, where, orderBy = { createdAt: 'desc' } } = params;
    const [items, total] = await Promise.all([
      this.prisma.class.findMany({
        skip,
        take,
        where,
        orderBy,
        include: { teacher: { include: { user: true } } },
      }),
      this.prisma.class.count({ where }),
    ]);
    return { items, total };
  }

  async update(id: string, data: Prisma.ClassUpdateInput) {
    return this.prisma.class.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.class.delete({ where: { id } });
  }
}
