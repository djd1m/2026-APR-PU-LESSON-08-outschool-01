import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ClassesRepository } from './classes.repository';
import { CreateClassDto } from './dto/create-class.dto';
import { slugify, MAX_CLASS_SIZE, ClassStatus } from '@klassmarket/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchService } from '../search/search.service';

@Injectable()
export class ClassesService {
  constructor(
    private classesRepository: ClassesRepository,
    private prisma: PrismaService,
    private searchService: SearchService,
  ) {}

  async create(teacherUserId: string, dto: CreateClassDto) {
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherUserId },
    });

    if (!profile) {
      throw new ForbiddenException('Only teachers can create classes');
    }

    if (dto.ageMin > dto.ageMax) {
      throw new BadRequestException('ageMin must be less than or equal to ageMax');
    }

    const slug = slugify(dto.title) + '-' + Date.now().toString(36);

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
      status: ClassStatus.DRAFT,
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

  async findByTeacher(teacherUserId: string) {
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherUserId },
    });

    if (!profile) {
      throw new ForbiddenException('Teacher profile not found');
    }

    const { items, total } = await this.classesRepository.findAll({
      where: { teacherId: profile.id },
      orderBy: { updatedAt: 'desc' },
    });

    return { items, total };
  }

  async update(id: string, teacherUserId: string, data: Partial<CreateClassDto>) {
    const cls = await this.findById(id);
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherUserId },
    });

    if (!profile || cls.teacherId !== profile.id) {
      throw new ForbiddenException('You can only update your own classes');
    }

    if (cls.status !== ClassStatus.DRAFT && cls.status !== ClassStatus.PUBLISHED) {
      throw new BadRequestException(
        'Can only update classes in DRAFT or PUBLISHED status',
      );
    }

    if (data.ageMin !== undefined && data.ageMax !== undefined && data.ageMin > data.ageMax) {
      throw new BadRequestException('ageMin must be less than or equal to ageMax');
    }

    // If updating a published class, reset to draft for re-review
    const updateData: Record<string, unknown> = { ...data };
    if (cls.status === ClassStatus.PUBLISHED) {
      updateData.status = ClassStatus.DRAFT;
    }

    return this.classesRepository.update(id, updateData);
  }

  async delete(id: string, teacherUserId: string) {
    const cls = await this.findById(id);
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherUserId },
    });

    if (!profile || cls.teacherId !== profile.id) {
      throw new ForbiddenException('You can only delete your own classes');
    }

    if (cls.status !== ClassStatus.DRAFT) {
      throw new BadRequestException('Can only delete classes in DRAFT status');
    }

    return this.classesRepository.delete(id);
  }

  async submitForReview(teacherUserId: string, classId: string) {
    const cls = await this.findById(classId);
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherUserId },
    });

    if (!profile || cls.teacherId !== profile.id) {
      throw new ForbiddenException('You can only submit your own classes');
    }

    if (cls.status !== ClassStatus.DRAFT) {
      throw new BadRequestException('Can only submit DRAFT classes for review');
    }

    return this.classesRepository.update(classId, {
      status: ClassStatus.PENDING_REVIEW,
    });
  }

  async approve(classId: string) {
    const cls = await this.findById(classId);

    if (cls.status !== ClassStatus.PENDING_REVIEW) {
      throw new BadRequestException('Can only approve classes in PENDING_REVIEW status');
    }

    const updated = await this.classesRepository.update(classId, {
      status: ClassStatus.PUBLISHED,
    });

    // Index in Elasticsearch
    try {
      const teacher = cls.teacher as any;
      await this.searchService.indexClass({
        id: cls.id,
        title: cls.title,
        description: cls.description,
        subject: cls.subject,
        ageMin: cls.ageMin,
        ageMax: cls.ageMax,
        price: Number(cls.price),
        teacherName: teacher?.user?.name ?? '',
        status: ClassStatus.PUBLISHED,
      });
    } catch {
      // Elasticsearch indexing failure should not block approval
      console.warn(`Failed to index class ${classId} in Elasticsearch`);
    }

    return updated;
  }

  async reject(classId: string, reason: string) {
    const cls = await this.findById(classId);

    if (cls.status !== ClassStatus.PENDING_REVIEW) {
      throw new BadRequestException('Can only reject classes in PENDING_REVIEW status');
    }

    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Rejection reason is required');
    }

    return this.classesRepository.update(classId, {
      status: ClassStatus.DRAFT,
      rejectionReason: reason.trim(),
    });
  }
}
