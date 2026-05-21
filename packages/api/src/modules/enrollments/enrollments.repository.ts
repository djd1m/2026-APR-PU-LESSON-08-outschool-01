import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

const enrollmentInclude = {
  child: true,
  section: {
    include: {
      class: {
        include: {
          teacher: {
            include: {
              user: { select: { name: true, avatarUrl: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.EnrollmentInclude;

@Injectable()
export class EnrollmentsRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.EnrollmentCreateInput) {
    return this.prisma.enrollment.create({
      data,
      include: enrollmentInclude,
    });
  }

  async findById(id: string) {
    return this.prisma.enrollment.findUnique({
      where: { id },
      include: {
        ...enrollmentInclude,
        payment: true,
      },
    });
  }

  async findByChildAndSection(childId: string, sectionId: string) {
    return this.prisma.enrollment.findUnique({
      where: { childId_sectionId: { childId, sectionId } },
    });
  }

  /**
   * Check if a child already has a trial enrollment for any section of this class.
   */
  async hasTrialForClass(childId: string, classId: string): Promise<boolean> {
    const count = await this.prisma.enrollment.count({
      where: {
        childId,
        isTrial: true,
        status: { not: 'CANCELLED' },
        section: { classId },
      },
    });
    return count > 0;
  }

  /**
   * Count active (non-cancelled) enrollments for a section.
   */
  async countBySectionId(sectionId: string): Promise<number> {
    return this.prisma.enrollment.count({
      where: {
        sectionId,
        status: { not: 'CANCELLED' },
      },
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
        include: enrollmentInclude,
      }),
      this.prisma.enrollment.count({ where }),
    ]);
    return { items, total };
  }

  async update(id: string, data: Prisma.EnrollmentUpdateInput) {
    return this.prisma.enrollment.update({ where: { id }, data });
  }
}
