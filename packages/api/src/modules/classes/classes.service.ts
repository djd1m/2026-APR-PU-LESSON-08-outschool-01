import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ClassesRepository } from './classes.repository';
import { CreateClassDto } from './dto/create-class.dto';
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
    return cls;
  }

  async findBySlug(slug: string) {
    const cls = await this.classesRepository.findBySlug(slug);
    if (!cls) {
      throw new NotFoundException('Class not found');
    }
    return cls;
  }

  async findAll(params: {
    page?: number;
    perPage?: number;
    subject?: string;
    ageMin?: number;
    ageMax?: number;
  }) {
    const { page = 1, perPage = 20, subject, ageMin, ageMax } = params;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = { status: 'PUBLISHED' };
    if (subject) where.subject = subject;
    if (ageMin) where.ageMin = { gte: ageMin };
    if (ageMax) where.ageMax = { lte: ageMax };

    const { items, total } = await this.classesRepository.findAll({
      skip,
      take: perPage,
      where,
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
