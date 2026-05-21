import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, SectionStatus } from '@prisma/client';

@Injectable()
export class SectionsRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.SectionCreateInput) {
    return this.prisma.section.create({
      data,
      include: { class: true },
    });
  }

  async findById(id: string) {
    return this.prisma.section.findUnique({
      where: { id },
      include: {
        class: { include: { teacher: true } },
        enrollments: true,
      },
    });
  }

  async findByClassId(classId: string) {
    return this.prisma.section.findMany({
      where: { classId },
      orderBy: { startTime: 'asc' },
      include: { class: true },
    });
  }

  async findTeacherSections(teacherProfileId: string, from: Date, to: Date) {
    return this.prisma.section.findMany({
      where: {
        class: { teacherId: teacherProfileId },
        startTime: { gte: from, lte: to },
        status: { not: SectionStatus.CANCELLED },
      },
      orderBy: { startTime: 'asc' },
      include: {
        class: true,
        enrollments: { where: { status: { in: ['CONFIRMED', 'ACTIVE'] } } },
      },
    });
  }

  async findOverlapping(
    teacherProfileId: string,
    startTime: Date,
    endTime: Date,
    excludeSectionId?: string,
  ) {
    const where: Prisma.SectionWhereInput = {
      class: { teacherId: teacherProfileId },
      status: { not: SectionStatus.CANCELLED },
      AND: [
        { startTime: { lt: endTime } },
        { endTime: { gt: startTime } },
      ],
    };

    if (excludeSectionId) {
      where.id = { not: excludeSectionId };
    }

    return this.prisma.section.findMany({ where });
  }

  async update(id: string, data: Prisma.SectionUpdateInput) {
    return this.prisma.section.update({
      where: { id },
      data,
      include: { class: true },
    });
  }

  async delete(id: string) {
    return this.prisma.section.update({
      where: { id },
      data: { status: SectionStatus.CANCELLED },
      include: {
        class: true,
        enrollments: {
          where: { status: { in: ['CONFIRMED', 'ACTIVE'] } },
          include: { child: { include: { parent: true } } },
        },
      },
    });
  }
}
