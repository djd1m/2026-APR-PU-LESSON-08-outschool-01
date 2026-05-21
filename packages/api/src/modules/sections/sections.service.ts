import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { SectionsRepository } from './sections.repository';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { SectionStatus } from '@prisma/client';

const DEFAULT_TIMEZONE = 'Europe/Moscow';

@Injectable()
export class SectionsService {
  constructor(
    private sectionsRepository: SectionsRepository,
    private prisma: PrismaService,
  ) {}

  private async getTeacherProfile(userId: string) {
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new ForbiddenException('Only teachers can manage sections');
    }
    return profile;
  }

  private computeEndTime(startTime: Date, durationMinutes: number): Date {
    return new Date(startTime.getTime() + durationMinutes * 60 * 1000);
  }

  async create(teacherUserId: string, dto: CreateSectionDto) {
    const profile = await this.getTeacherProfile(teacherUserId);

    // Verify class ownership
    const cls = await this.prisma.class.findUnique({
      where: { id: dto.classId },
    });

    if (!cls) {
      throw new NotFoundException('Class not found');
    }

    if (cls.teacherId !== profile.id) {
      throw new ForbiddenException('You can only create sections for your own classes');
    }

    const startTime = new Date(dto.startTime);
    if (isNaN(startTime.getTime())) {
      throw new BadRequestException('Invalid startTime format');
    }

    if (startTime <= new Date()) {
      throw new BadRequestException('Section start time must be in the future');
    }

    const endTime = this.computeEndTime(startTime, dto.durationMinutes);

    // Check for time conflicts
    const overlapping = await this.sectionsRepository.findOverlapping(
      profile.id,
      startTime,
      endTime,
    );

    if (overlapping.length > 0) {
      throw new ConflictException(
        'Time conflict: you already have a section scheduled during this period',
      );
    }

    return this.sectionsRepository.create({
      startTime,
      endTime,
      maxStudents: cls.maxStudents,
      class: { connect: { id: dto.classId } },
    });
  }

  async update(teacherUserId: string, sectionId: string, dto: UpdateSectionDto) {
    const profile = await this.getTeacherProfile(teacherUserId);
    const section = await this.sectionsRepository.findById(sectionId);

    if (!section) {
      throw new NotFoundException('Section not found');
    }

    if (section.class.teacherId !== profile.id) {
      throw new ForbiddenException('You can only update your own sections');
    }

    if (section.status !== SectionStatus.SCHEDULED) {
      throw new BadRequestException('Only SCHEDULED sections can be updated');
    }

    const startTime = dto.startTime ? new Date(dto.startTime) : section.startTime;
    const durationMinutes = dto.durationMinutes
      ? dto.durationMinutes
      : (section.endTime.getTime() - section.startTime.getTime()) / (60 * 1000);
    const endTime = this.computeEndTime(startTime, durationMinutes);

    if (dto.startTime && startTime <= new Date()) {
      throw new BadRequestException('Section start time must be in the future');
    }

    // Check for time conflicts (exclude current section)
    const overlapping = await this.sectionsRepository.findOverlapping(
      profile.id,
      startTime,
      endTime,
      sectionId,
    );

    if (overlapping.length > 0) {
      throw new ConflictException(
        'Time conflict: you already have a section scheduled during this period',
      );
    }

    return this.sectionsRepository.update(sectionId, {
      startTime,
      endTime,
    });
  }

  async cancel(teacherUserId: string, sectionId: string) {
    const profile = await this.getTeacherProfile(teacherUserId);
    const section = await this.sectionsRepository.findById(sectionId);

    if (!section) {
      throw new NotFoundException('Section not found');
    }

    if (section.class.teacherId !== profile.id) {
      throw new ForbiddenException('You can only cancel your own sections');
    }

    if (section.status === SectionStatus.CANCELLED) {
      throw new BadRequestException('Section is already cancelled');
    }

    if (section.status === SectionStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed section');
    }

    const cancelled = await this.sectionsRepository.delete(sectionId);

    // Queue notifications for enrolled students' parents
    // In production this would use BullMQ to enqueue notification jobs
    // for each enrolled student's parent user
    if (cancelled.enrollments && cancelled.enrollments.length > 0) {
      console.log(
        `[sections] Section ${sectionId} cancelled — ${cancelled.enrollments.length} enrolled student(s) to notify`,
      );
      // BullMQ integration placeholder:
      // for (const enrollment of cancelled.enrollments) {
      //   await this.notificationQueue.add('section-cancelled', {
      //     userId: enrollment.child.parent.id,
      //     channel: 'in-app',
      //     title: 'Занятие отменено',
      //     body: `Занятие "${cancelled.class.title}" отменено преподавателем`,
      //   });
      // }
    }

    return cancelled;
  }

  async findByClassId(classId: string) {
    return this.sectionsRepository.findByClassId(classId);
  }

  async getTeacherSchedule(
    teacherUserId: string,
    from?: string,
    to?: string,
  ) {
    const profile = await this.getTeacherProfile(teacherUserId);

    // Default: current week (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const defaultFrom = new Date(now);
    defaultFrom.setDate(now.getDate() + mondayOffset);
    defaultFrom.setHours(0, 0, 0, 0);

    const defaultTo = new Date(defaultFrom);
    defaultTo.setDate(defaultFrom.getDate() + 6);
    defaultTo.setHours(23, 59, 59, 999);

    const fromDate = from ? new Date(from) : defaultFrom;
    const toDate = to ? new Date(to) : defaultTo;

    return this.sectionsRepository.findTeacherSections(profile.id, fromDate, toDate);
  }
}
