import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ClassesRepository } from './classes.repository';
import { CreateClassDto } from './dto/create-class.dto';
import { ClassFilterDto } from './dto/class-filter.dto';
import { slugify, MAX_CLASS_SIZE } from '@klassmarket/shared';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class ClassesService {
  constructor(
    private classesRepository: ClassesRepository,
    private prisma: PrismaService,
  ) {}

  private generateSlug(title: string): string {
    const base = title
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    const suffix = crypto.randomBytes(4).toString('hex');
    return `${base}-${suffix}`;
  }

  async create(teacherUserId: string, dto: CreateClassDto) {
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherUserId },
    });

    if (!profile) {
      throw new ForbiddenException('Only teachers can create classes');
    }

    const slug = this.generateSlug(dto.title);

    return this.classesRepository.create({
      title: dto.title,
      description: dto.description,
      subject: dto.subject,
      price: dto.price,
      ageMin: dto.ageMin,
      ageMax: dto.ageMax,
      maxStudents: dto.maxStudents ?? MAX_CLASS_SIZE,
      slug,
      imageUrl: dto.imageUrl,
      teacher: { connect: { id: profile.id } },
    });
  }

  async findById(id: string) {
    const cls = await this.classesRepository.findById(id);
    if (!cls) {
      throw new NotFoundException('Class not found');
    }

    // Compute average rating from reviews
    const { avg, count } = await this.classesRepository.getAverageRating(id);

    return {
      ...cls,
      avgRating: Math.round(avg * 10) / 10,
      reviewCount: count,
    };
  }

  async findBySlug(slug: string) {
    const cls = await this.classesRepository.findBySlug(slug);
    if (!cls) {
      throw new NotFoundException('Class not found');
    }
    return cls;
  }

  async findAll(filters: ClassFilterDto) {
    const {
      page = 1,
      limit = 20,
      subject,
      ageMin,
      ageMax,
      priceMin,
      priceMax,
      query,
      sort,
      cursor,
    } = filters;

    const skip = cursor ? 0 : (page - 1) * limit;

    const where: Record<string, unknown> = { status: 'PUBLISHED' };

    if (subject) {
      where.subject = subject;
    }
    if (ageMin !== undefined) {
      where.ageMin = { gte: ageMin };
    }
    if (ageMax !== undefined) {
      where.ageMax = { lte: ageMax };
    }
    if (priceMin !== undefined || priceMax !== undefined) {
      where.price = {
        ...(priceMin !== undefined ? { gte: priceMin } : {}),
        ...(priceMax !== undefined ? { lte: priceMax } : {}),
      };
    }
    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ];
    }

    const { items, total } = await this.classesRepository.findAll({
      skip,
      take: limit,
      cursor: cursor ?? undefined,
      where,
      sort,
    });

    // Map items to include teacher name and computed fields
    const mapped = items.map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      subject: item.subject,
      price: item.price,
      ageMin: item.ageMin,
      ageMax: item.ageMax,
      maxStudents: item.maxStudents,
      slug: item.slug,
      imageUrl: item.imageUrl,
      status: item.status,
      createdAt: item.createdAt,
      teacherName: item.teacher?.user
        ? `${item.teacher.user.firstName} ${item.teacher.user.lastName}`
        : '',
      teacherAvatarUrl: item.teacher?.user?.avatarUrl ?? null,
      reviewCount: item._count?.reviews ?? 0,
      sectionCount: item._count?.sections ?? 0,
    }));

    const nextCursor = items.length === limit ? items[items.length - 1]?.id : null;

    return {
      items: mapped,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        nextCursor,
      },
    };
  }

  async getSubjects(): Promise<string[]> {
    return this.classesRepository.getDistinctSubjects();
  }

  async update(id: string, teacherUserId: string, data: Partial<CreateClassDto>) {
    const cls = await this.findById(id);
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherUserId },
    });

    if (!profile || cls.teacherId !== profile.id) {
      throw new ForbiddenException('You can only update your own classes');
    }

    return this.classesRepository.update(id, data);
  }

  async delete(id: string, teacherUserId: string) {
    const cls = await this.findById(id);
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherUserId },
    });

    if (!profile || cls.teacherId !== profile.id) {
      throw new ForbiddenException('You can only delete your own classes');
    }

    return this.classesRepository.delete(id);
  }
}
