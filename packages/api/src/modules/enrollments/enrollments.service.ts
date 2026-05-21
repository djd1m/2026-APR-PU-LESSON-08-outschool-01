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

  /**
   * Book a free trial lesson. One trial per child per class.
   * No payment required, no credit card needed.
   */
  async createTrial(parentId: string, childId: string, sectionId: string) {
    // 1. Verify child belongs to parent
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
    });
    if (!child) {
      throw new NotFoundException('Child not found');
    }
    if (child.parentId !== parentId) {
      throw new ForbiddenException('Child does not belong to this parent');
    }

    // 2. Verify section exists and load class info
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: { class: true },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }

    // 3. Check seat availability
    const enrolledCount = await this.enrollmentsRepository.countBySectionId(sectionId);
    if (enrolledCount >= section.maxStudents) {
      throw new BadRequestException('Section is full');
    }

    // 4. Check child age against class range
    const today = new Date();
    const birthDate = new Date(child.birthDate);
    let childAge = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      childAge--;
    }
    if (childAge < section.class.ageMin || childAge > section.class.ageMax) {
      throw new BadRequestException(
        `Child age (${childAge}) is outside the class range (${section.class.ageMin}-${section.class.ageMax})`,
      );
    }

    // 5. Check one trial per child per class
    const hasTrial = await this.enrollmentsRepository.hasTrialForClass(
      childId,
      section.classId,
    );
    if (hasTrial) {
      throw new ConflictException('Trial already used for this class');
    }

    // 6. Check if already enrolled in this section
    const existing = await this.enrollmentsRepository.findByChildAndSection(
      childId,
      sectionId,
    );
    if (existing) {
      throw new ConflictException('Child is already enrolled in this section');
    }

    // 7. Create free trial enrollment (confirmed immediately, no payment)
    const enrollment = await this.enrollmentsRepository.create({
      child: { connect: { id: childId } },
      section: { connect: { id: sectionId } },
      isTrial: true,
      status: 'CONFIRMED',
    });

    await this.prisma.section.update({
      where: { id: sectionId },
      data: { enrolledCount: { increment: 1 } },
    });

    return enrollment;
  }

  /**
   * Book a paid enrollment (creates pending payment).
   */
  async create(parentId: string, childId: string, sectionId: string) {
    // Verify child belongs to parent
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
    });
    if (!child) {
      throw new NotFoundException('Child not found');
    }
    if (child.parentId !== parentId) {
      throw new ForbiddenException('Child does not belong to this parent');
    }

    const existing = await this.enrollmentsRepository.findByChildAndSection(
      childId,
      sectionId,
    );
    if (existing) {
      throw new ConflictException('Child is already enrolled in this section');
    }

    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: { class: true },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }

    const enrolledCount = await this.enrollmentsRepository.countBySectionId(sectionId);
    if (enrolledCount >= section.maxStudents) {
      throw new BadRequestException('Section is full');
    }

    const enrollment = await this.enrollmentsRepository.create({
      child: { connect: { id: childId } },
      section: { connect: { id: sectionId } },
    });

    // Create pending payment
    const price = section.class.price;
    const commission = Number(price) * 0.15;
    const teacherPayout = Number(price) - commission;

    await this.prisma.payment.create({
      data: {
        enrollment: { connect: { id: enrollment.id } },
        amount: price,
        commission,
        teacherPayout,
        status: 'PENDING',
      },
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

    // Verify parent owns this enrollment's child
    const child = await this.prisma.child.findUnique({
      where: { id: enrollment.childId },
    });
    if (!child || child.parentId !== parentId) {
      throw new ForbiddenException('Not authorized to cancel this enrollment');
    }

    if (enrollment.status === 'CANCELLED') {
      throw new BadRequestException('Enrollment is already cancelled');
    }

    await this.enrollmentsRepository.update(enrollmentId, {
      status: 'CANCELLED',
      cancelledAt: new Date(),
    });

    await this.prisma.section.update({
      where: { id: enrollment.sectionId },
      data: { enrolledCount: { decrement: 1 } },
    });

    // Refund if there was a completed payment
    if (enrollment.payment && enrollment.payment.status === 'COMPLETED') {
      await this.prisma.payment.update({
        where: { id: enrollment.payment.id },
        data: { status: 'REFUNDED', refundedAt: new Date() },
      });
    }

    return { message: 'Enrollment cancelled' };
  }

  /**
   * Check trial status for a child + class combination.
   */
  async getTrialStatus(childId: string, classId: string) {
    const hasTrial = await this.enrollmentsRepository.hasTrialForClass(childId, classId);
    return { hasTrial };
  }
}
