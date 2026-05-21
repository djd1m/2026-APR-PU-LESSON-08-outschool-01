import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { teacherProfile: true, children: true },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    where?: Prisma.UserWhereInput;
  }) {
    const { skip = 0, take = 20, where } = params;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ skip, take, where, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  async update(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  async createChild(parentId: string, data: { name: string; birthDate: Date; interests: string[] }) {
    return this.prisma.child.create({
      data: {
        name: data.name,
        birthDate: data.birthDate,
        interests: data.interests,
        parentId,
      },
    });
  }

  async findChildrenByParentId(parentId: string) {
    return this.prisma.child.findMany({
      where: { parentId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
