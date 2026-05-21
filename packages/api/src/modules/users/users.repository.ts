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

  // --- Teacher profile queries ---

  async findTeachers(params: {
    skip?: number;
    take?: number;
    subject?: string;
    search?: string;
  }) {
    const { skip = 0, take = 20, subject, search } = params;

    const where: Prisma.TeacherProfileWhereInput = {
      verified: true,
      ...(subject ? { subjects: { has: subject } } : {}),
      ...(search
        ? { user: { name: { contains: search, mode: 'insensitive' as const } } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.teacherProfile.findMany({
        skip,
        take,
        where,
        orderBy: { rating: 'desc' },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          classes: {
            where: { status: 'PUBLISHED' },
            select: { id: true },
          },
        },
      }),
      this.prisma.teacherProfile.count({ where }),
    ]);

    return { items, total };
  }

  async findTeacherProfileById(profileId: string) {
    return this.prisma.teacherProfile.findUnique({
      where: { id: profileId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, createdAt: true } },
        classes: {
          where: { status: 'PUBLISHED' },
          include: {
            sections: {
              select: {
                id: true,
                enrolledCount: true,
              },
            },
          },
        },
      },
    });
  }

  async findTeacherProfileByUserId(userId: string) {
    return this.prisma.teacherProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, createdAt: true } },
        classes: {
          where: { status: 'PUBLISHED' },
          include: {
            sections: {
              select: {
                id: true,
                enrolledCount: true,
              },
            },
          },
        },
      },
    });
  }

  async updateTeacherProfile(
    userId: string,
    data: {
      bio?: string;
      education?: string;
      experience?: string;
      subjects?: string[];
    },
  ) {
    return this.prisma.teacherProfile.update({
      where: { userId },
      data,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async submitTeacherVerification(userId: string) {
    return this.prisma.teacherProfile.update({
      where: { userId },
      data: { verificationStatus: 'pending' },
    });
  }

  async getTeacherReviews(teacherProfileId: string) {
    return this.prisma.review.findMany({
      where: {
        enrollment: {
          section: {
            class: { teacherId: teacherProfileId },
          },
        },
      },
      include: {
        enrollment: {
          include: {
            child: {
              select: { name: true, parent: { select: { name: true } } },
            },
            section: {
              select: { class: { select: { title: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async getTeacherStats(teacherProfileId: string) {
    const [totalStudents, totalClasses] = await Promise.all([
      this.prisma.enrollment.count({
        where: {
          status: { in: ['ACTIVE', 'COMPLETED'] },
          section: {
            class: { teacherId: teacherProfileId },
          },
        },
      }),
      this.prisma.class.count({
        where: { teacherId: teacherProfileId, status: 'PUBLISHED' },
      }),
    ]);

    return { totalStudents, totalClasses };
  }
}
