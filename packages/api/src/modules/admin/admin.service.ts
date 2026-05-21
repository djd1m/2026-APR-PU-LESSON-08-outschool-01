import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getPlatformStats() {
    const [
      totalUsers,
      totalTeachers,
      totalStudents,
      totalClasses,
      totalBookings,
      revenueResult,
      mauResult,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.teacherProfile.count(),
      this.prisma.child.count(),
      this.prisma.class.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.enrollment.count(),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'COMPLETED' },
      }),
      // MAU: unique users who logged in within the last 30 days (approximate via updatedAt)
      this.prisma.user.count({
        where: {
          updatedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      totalUsers,
      totalTeachers,
      totalStudents,
      totalClasses,
      totalBookings,
      gmv: Number(revenueResult._sum.amount ?? 0),
      mau: mauResult,
      revenue: Number(revenueResult._sum.amount ?? 0),
    };
  }

  async getPendingClasses(page = 1, perPage = 20) {
    const skip = (page - 1) * perPage;
    const where = { status: 'PENDING_REVIEW' as const };

    const [items, total] = await Promise.all([
      this.prisma.class.findMany({
        skip,
        take: perPage,
        where,
        orderBy: { createdAt: 'desc' },
        include: { teacher: { include: { user: true } } },
      }),
      this.prisma.class.count({ where }),
    ]);

    return {
      items,
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async getFlaggedReviews(page = 1, perPage = 20) {
    const skip = (page - 1) * perPage;
    const where = { flagged: true };

    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        skip,
        take: perPage,
        where,
        orderBy: { createdAt: 'desc' },
        include: { enrollment: { include: { child: true, section: { include: { class: true } } } } },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      items,
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async approveClass(id: string) {
    const cls = await this.prisma.class.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException('Class not found');

    return this.prisma.class.update({
      where: { id },
      data: { status: 'PUBLISHED' },
    });
  }

  async rejectClass(id: string) {
    const cls = await this.prisma.class.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException('Class not found');

    return this.prisma.class.update({
      where: { id },
      data: { status: 'DRAFT' },
    });
  }

  async verifyTeacher(id: string) {
    const profile = await this.prisma.teacherProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Teacher profile not found');

    return this.prisma.teacherProfile.update({
      where: { id },
      data: { verified: true },
    });
  }

  async rejectTeacher(id: string) {
    const profile = await this.prisma.teacherProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Teacher profile not found');

    return this.prisma.teacherProfile.update({
      where: { id },
      data: { verified: false },
    });
  }
}
