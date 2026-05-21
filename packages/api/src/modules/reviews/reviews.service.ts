import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ReviewsRepository } from './reviews.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private reviewsRepository: ReviewsRepository,
    private prisma: PrismaService,
  ) {}

  async create(parentId: string, dto: CreateReviewDto) {
    const { enrollmentId, rating, comment } = dto;

    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    if (comment && comment.length > 2000) {
      throw new BadRequestException('Comment must not exceed 2000 characters');
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { child: true },
    });
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    // Verify the parent owns this enrollment
    if (enrollment.child.parentId !== parentId) {
      throw new BadRequestException('You can only review your own enrollments');
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

  async findByTeacher(teacherId: string, page = 1, perPage = 20) {
    const skip = (page - 1) * perPage;
    const { items, total } = await this.reviewsRepository.findAll({
      skip,
      take: perPage,
      where: { enrollment: { section: { class: { teacherId } } } },
    });

    return {
      items,
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async flagForModeration(reviewId: string, reason?: string) {
    const review = await this.findById(reviewId);
    return this.reviewsRepository.update(review.id, {
      flagged: true,
      flagReason: reason || 'Flagged for moderation',
    });
  }

  async unflag(reviewId: string) {
    const review = await this.findById(reviewId);
    return this.reviewsRepository.update(review.id, {
      flagged: false,
      flagReason: null,
    });
  }

  async findFlagged(page = 1, perPage = 20) {
    const skip = (page - 1) * perPage;
    const { items, total } = await this.reviewsRepository.findFlagged({
      skip,
      take: perPage,
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
