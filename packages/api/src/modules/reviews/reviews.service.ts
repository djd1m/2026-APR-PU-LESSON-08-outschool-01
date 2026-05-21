import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ReviewsRepository } from './reviews.repository';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(
    private reviewsRepository: ReviewsRepository,
    private prisma: PrismaService,
  ) {}

  async create(enrollmentId: string, rating: number, comment?: string) {
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    if (enrollment.status !== 'COMPLETED' && enrollment.status !== 'ACTIVE') {
      throw new BadRequestException('Can only review active or completed enrollments');
    }

    const existing = await this.reviewsRepository.findByEnrollmentId(enrollmentId);
    if (existing) {
      throw new ConflictException('Review already exists for this enrollment');
    }

    const review = await this.reviewsRepository.create({
      rating,
      comment,
      enrollment: { connect: { id: enrollmentId } },
    });

    // Update teacher rating
    const section = await this.prisma.section.findUnique({
      where: { id: enrollment.sectionId },
      include: { class: true },
    });
    if (section) {
      const stats = await this.reviewsRepository.getAverageRatingForTeacher(
        section.class.teacherId,
      );
      await this.prisma.teacherProfile.update({
        where: { id: section.class.teacherId },
        data: { rating: stats.average, reviewCount: stats.count },
      });
    }

    return review;
  }

  async findById(id: string) {
    const review = await this.reviewsRepository.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }

  async findByClass(classId: string, page = 1, perPage = 20) {
    const skip = (page - 1) * perPage;
    const { items, total } = await this.reviewsRepository.findAll({
      skip,
      take: perPage,
      where: { enrollment: { section: { classId } } },
    });

    return {
      items,
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async delete(id: string) {
    await this.findById(id);
    return this.reviewsRepository.delete(id);
  }
}
