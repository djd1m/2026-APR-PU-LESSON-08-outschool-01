import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private usersRepository: UsersRepository,
    private prisma: PrismaService,
  ) {}

  async findById(id: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findAll(page = 1, perPage = 20) {
    const skip = (page - 1) * perPage;
    const { items, total } = await this.usersRepository.findAll({
      skip,
      take: perPage,
    });

    return {
      items,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async update(id: string, data: { name?: string; phone?: string; avatarUrl?: string }) {
    await this.findById(id);
    return this.usersRepository.update(id, data);
  }

  async delete(id: string) {
    await this.findById(id);
    return this.usersRepository.delete(id);
  }

  async getParentDashboard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { children: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const childIds = user.children.map((c) => c.id);

    const [upcomingClasses, totalSpentResult, enrollments, payments] = await Promise.all([
      // Upcoming classes: enrollments with future section start times
      this.prisma.enrollment.findMany({
        where: {
          childId: { in: childIds },
          status: { in: ['CONFIRMED', 'ACTIVE'] },
          section: { startTime: { gte: new Date() } },
        },
        include: {
          section: { include: { class: { include: { teacher: { include: { user: true } } } } } },
          child: true,
        },
        orderBy: { section: { startTime: 'asc' } },
        take: 20,
      }),
      // Total spent
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: 'COMPLETED',
          enrollment: { childId: { in: childIds } },
        },
      }),
      // Enrollments for progress stats
      this.prisma.enrollment.findMany({
        where: { childId: { in: childIds } },
        include: {
          section: { include: { class: true } },
          child: true,
        },
      }),
      // Payment history
      this.prisma.payment.findMany({
        where: {
          enrollment: { childId: { in: childIds } },
        },
        include: {
          enrollment: { include: { section: { include: { class: true } }, child: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    // Per-child progress
    const childProgress = user.children.map((child) => {
      const childEnrollments = enrollments.filter((e) => e.childId === child.id);
      const completed = childEnrollments.filter((e) => e.status === 'COMPLETED');
      const subjects = [...new Set(childEnrollments.map((e) => e.section.class.subject))];
      const totalMinutes = completed.length * 60; // Approximate: 1 session ~ 60 min

      return {
        child: { id: child.id, name: child.name, birthDate: child.birthDate },
        classesAttended: completed.length,
        totalClasses: childEnrollments.length,
        subjects,
        hoursSpent: Math.round(totalMinutes / 60),
      };
    });

    // Payment history formatted
    const paymentHistory = payments.map((p) => ({
      id: p.id,
      date: p.createdAt,
      className: p.enrollment.section.class.title,
      childName: p.enrollment.child.name,
      amount: Number(p.amount),
      status: p.status,
    }));

    return {
      user: { id: user.id, name: user.name, email: user.email },
      children: user.children,
      upcomingClasses: upcomingClasses.map((e) => ({
        enrollmentId: e.id,
        classId: e.section.class.id,
        classTitle: e.section.class.title,
        teacherName: e.section.class.teacher.user.name,
        childName: e.child.name,
        startTime: e.section.startTime,
        endTime: e.section.endTime,
        status: e.status,
      })),
      totalSpent: Number(totalSpentResult._sum.amount ?? 0),
      childrenCount: user.children.length,
      childProgress,
      paymentHistory,
    };
  }

  async getTeacherDashboard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true },
    });
    if (!user || !user.teacherProfile) {
      throw new NotFoundException('Teacher profile not found');
    }

    const teacherProfileId = user.teacherProfile.id;

    const [
      classes,
      totalEarnedResult,
      studentsThisMonth,
      recentReviews,
    ] = await Promise.all([
      // Teacher's classes
      this.prisma.class.findMany({
        where: { teacherId: teacherProfileId },
        include: {
          sections: {
            where: { startTime: { gte: new Date() } },
            include: { _count: { select: { enrollments: true } } },
            orderBy: { startTime: 'asc' },
            take: 5,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Total earned
      this.prisma.payment.aggregate({
        _sum: { teacherPayout: true },
        where: {
          status: 'COMPLETED',
          enrollment: { section: { class: { teacherId: teacherProfileId } } },
        },
      }),
      // Students this month
      this.prisma.enrollment.count({
        where: {
          section: { class: { teacherId: teacherProfileId } },
          enrolledAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      // Recent reviews
      this.prisma.review.findMany({
        where: {
          enrollment: { section: { class: { teacherId: teacherProfileId } } },
        },
        include: {
          enrollment: { include: { child: true, section: { include: { class: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const activeClasses = classes.filter((c) => c.status === 'PUBLISHED');

    // Upcoming sections with enrolled count
    const upcomingSections = classes.flatMap((c) =>
      c.sections.map((s) => ({
        sectionId: s.id,
        classId: c.id,
        classTitle: c.title,
        startTime: s.startTime,
        endTime: s.endTime,
        enrolledCount: s._count.enrollments,
        maxStudents: s.maxStudents,
      })),
    ).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 10);

    return {
      teacher: {
        id: user.teacherProfile.id,
        name: user.name,
        rating: Number(user.teacherProfile.rating),
        reviewCount: user.teacherProfile.reviewCount,
        verified: user.teacherProfile.verified,
      },
      totalEarned: Number(totalEarnedResult._sum.teacherPayout ?? 0),
      studentsThisMonth,
      avgRating: Number(user.teacherProfile.rating),
      activeClassesCount: activeClasses.length,
      totalClassesCount: classes.length,
      upcomingSections,
      recentReviews: recentReviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        childName: r.enrollment.child.name,
        className: r.enrollment.section.class.title,
        createdAt: r.createdAt,
      })),
    };
  }
}
