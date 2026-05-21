import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EnrollmentsRepository } from './enrollments.repository';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EnrollmentsService {
  constructor(
    private enrollmentsRepository: EnrollmentsRepository,
    private prisma: PrismaService,
  ) {}

  async create(childId: string, sectionId: string) {
    const existing = await this.enrollmentsRepository.findByChildAndSection(
      childId,
      sectionId,
    );
    if (existing) {
      throw new ConflictException('Child is already enrolled in this section');
    }

    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    if (section.enrolledCount >= section.maxStudents) {
      throw new BadRequestException('Section is full');
    }

    const enrollment = await this.enrollmentsRepository.create({
      child: { connect: { id: childId } },
      section: { connect: { id: sectionId } },
    });

    await this.prisma.section.update({
      where: { id: sectionId },
      data: { enrolledCount: { increment: 1 } },
    });

    return enrollment;
  }

  async findById(id: string, parentId?: string) {
    const enrollment = await this.enrollmentsRepository.findById(id);
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }
    if (parentId) {
      await this.verifyEnrollmentOwnership(enrollment.childId, parentId);
    }
    return enrollment;
  }

  private async verifyEnrollmentOwnership(childId: string, parentId: string) {
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      select: { parentId: true },
    });
    if (!child || child.parentId !== parentId) {
      throw new ForbiddenException('Access denied to this enrollment');
    }
  }

  async findByParent(parentId: string, page = 1, perPage = 20) {
    const children = await this.prisma.child.findMany({
      where: { parentId },
      select: { id: true },
    });
    const childIds = children.map((c) => c.id);

    const skip = (page - 1) * perPage;
    const { items, total } = await this.enrollmentsRepository.findAll({
      skip,
      take: perPage,
      where: { childId: { in: childIds } },
    });

    return {
      items,
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async cancel(id: string, parentId?: string) {
    const enrollment = await this.findById(id, parentId);

    await this.enrollmentsRepository.update(id, {
      status: 'CANCELLED',
      cancelledAt: new Date(),
    });

    await this.prisma.section.update({
      where: { id: enrollment.sectionId },
      data: { enrolledCount: { decrement: 1 } },
    });

    return { message: 'Enrollment cancelled' };
  }
}
