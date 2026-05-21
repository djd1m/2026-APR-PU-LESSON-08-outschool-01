import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

@Injectable()
export class UsersService {
  constructor(private usersRepository: UsersRepository) {}

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

  // --- Teacher profiles ---

  async getTeachers(filters: {
    page?: number;
    perPage?: number;
    subject?: string;
    search?: string;
  }) {
    const { page = 1, perPage = 20, subject, search } = filters;
    const skip = (page - 1) * perPage;

    const { items, total } = await this.usersRepository.findTeachers({
      skip,
      take: perPage,
      subject,
      search,
    });

    const data = items.map((tp) => ({
      id: tp.id,
      userId: tp.user.id,
      name: tp.user.name,
      avatarUrl: tp.user.avatarUrl,
      bio: tp.bio,
      subjects: tp.subjects,
      rating: Number(tp.rating),
      reviewCount: tp.reviewCount,
      verified: tp.verified,
      classesCount: tp.classes.length,
    }));

    return {
      data,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async getTeacherProfile(profileId: string) {
    const tp = await this.usersRepository.findTeacherProfileById(profileId);
    if (!tp) {
      throw new NotFoundException('Teacher profile not found');
    }

    const stats = await this.usersRepository.getTeacherStats(tp.id);
    const reviews = await this.usersRepository.getTeacherReviews(tp.id);

    const totalStudents = tp.classes.reduce(
      (sum, cls) => sum + cls.sections.reduce((s, sec) => s + sec.enrolledCount, 0),
      0,
    );

    return {
      id: tp.id,
      userId: tp.user.id,
      name: tp.user.name,
      avatarUrl: tp.user.avatarUrl,
      memberSince: tp.user.createdAt,
      bio: tp.bio,
      education: tp.education,
      experience: tp.experience,
      subjects: tp.subjects,
      rating: Number(tp.rating),
      reviewCount: tp.reviewCount,
      verified: tp.verified,
      totalStudents: stats.totalStudents,
      totalClasses: stats.totalClasses,
      classes: tp.classes.map((cls) => ({
        id: cls.id,
        title: cls.title,
        subject: cls.subject,
        price: Number(cls.price),
        ageMin: cls.ageMin,
        ageMax: cls.ageMax,
        imageUrl: cls.imageUrl,
      })),
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        className: r.enrollment.section.class.title,
        reviewerName: r.enrollment.child.parent.name,
      })),
    };
  }

  async updateTeacherProfile(userId: string, dto: UpdateTeacherDto) {
    const user = await this.findById(userId);
    if (!user.teacherProfile) {
      throw new ForbiddenException('User does not have a teacher profile');
    }

    // Update avatar on user if provided
    if (dto.avatarUrl) {
      await this.usersRepository.update(userId, { avatarUrl: dto.avatarUrl });
    }

    return this.usersRepository.updateTeacherProfile(userId, {
      bio: dto.bio,
      education: dto.education,
      experience: dto.experience,
      subjects: dto.subjects,
    });
  }

  async submitVerification(userId: string) {
    const user = await this.findById(userId);
    if (!user.teacherProfile) {
      throw new ForbiddenException('User does not have a teacher profile');
    }

    return this.usersRepository.submitTeacherVerification(userId);
  }
}
