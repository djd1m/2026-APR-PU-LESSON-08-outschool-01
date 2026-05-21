import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { VideoRepository } from './video.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';

/**
 * JWT generation for Jitsi Meet.
 *
 * Jitsi expects a JWT with:
 *   - iss: app ID
 *   - sub: Jitsi domain
 *   - room: room name
 *   - aud: app ID
 *   - context.user: { name, id, avatar, moderator }
 *   - exp: expiration timestamp
 *
 * We use a simple HMAC-SHA256 implementation here rather than pulling in
 * a full JWT library, since the Jitsi JWT payload is fixed and small.
 */
function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

interface JitsiJwtPayload {
  room: string;
  sub: string;
  name: string;
  moderator: boolean;
  userId: string;
}

@Injectable()
export class VideoService {
  private videoRoomCloseQueue: Queue | null = null;
  private notificationQueue: Queue | null = null;

  constructor(
    private videoRepository: VideoRepository,
    private prisma: PrismaService,
  ) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    // Lazy-init BullMQ queues (tolerant of missing Redis in tests)
    try {
      const IORedis = require('ioredis');
      const connection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
      this.videoRoomCloseQueue = new Queue('video-room-close', { connection });
      this.notificationQueue = new Queue('notification', { connection });
    } catch {
      console.warn('[video] BullMQ queues unavailable — auto-close and notifications disabled');
    }
  }

  /**
   * Generate a Jitsi-compatible JWT token.
   */
  private generateJitsiJwt(payload: JitsiJwtPayload): string {
    const jitsiDomain = process.env.JITSI_DOMAIN || 'meet.jit.si';
    const appId = process.env.JITSI_APP_ID || 'klassmarket';
    const secret = process.env.JITSI_SECRET || 'dev-secret-change-in-production-min32chars!!';

    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);

    const jwtPayload = {
      iss: appId,
      sub: jitsiDomain,
      aud: appId,
      room: payload.room,
      exp: now + 3600, // 1 hour
      iat: now,
      context: {
        user: {
          id: payload.userId,
          name: payload.name,
          moderator: payload.moderator,
        },
      },
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Create a video room for a section. Teacher only.
   */
  async createRoom(teacherUserId: string, sectionId: string) {
    // Validate teacher owns the section
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: { class: { include: { teacher: true } } },
    });

    if (!section) {
      throw new NotFoundException('Section not found');
    }

    if (section.class.teacher.userId !== teacherUserId) {
      throw new ForbiddenException('Only the teacher who owns this class can create a video room');
    }

    // Check if room already exists
    const existing = await this.videoRepository.findBySectionId(sectionId);
    if (existing) {
      throw new ConflictException('Video room already exists for this section');
    }

    // Generate unique room name based on section UUID
    const roomName = `km-${sectionId}`;

    // Create room
    const room = await this.videoRepository.createRoom({
      section: { connect: { id: sectionId } },
      roomName,
      status: 'WAITING',
    });

    // Schedule auto-close: 10 minutes after section endTime
    if (this.videoRoomCloseQueue) {
      const delay = section.endTime.getTime() - Date.now() + 10 * 60 * 1000;
      if (delay > 0) {
        await this.videoRoomCloseQueue.add(
          'auto-close',
          { sectionId, roomName },
          {
            delay,
            jobId: `auto-close-${sectionId}`,
            removeOnComplete: true,
            removeOnFail: 5,
          },
        );
      }
    }

    // Generate moderator JWT for the teacher
    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherUserId },
    });

    const jwt = this.generateJitsiJwt({
      room: roomName,
      sub: teacherUserId,
      name: teacher?.name || 'Teacher',
      moderator: true,
      userId: teacherUserId,
    });

    return {
      id: room.id,
      sectionId: room.sectionId,
      roomName: room.roomName,
      status: room.status,
      jitsiDomain: process.env.JITSI_DOMAIN || 'meet.jit.si',
      jwt,
      createdAt: room.createdAt,
    };
  }

  /**
   * Get room info for a section.
   */
  async getRoomInfo(sectionId: string) {
    const room = await this.videoRepository.findBySectionId(sectionId);
    if (!room) {
      throw new NotFoundException('Video room not found for this section');
    }

    return {
      id: room.id,
      sectionId: room.sectionId,
      roomName: room.roomName,
      status: room.status,
      jitsiDomain: process.env.JITSI_DOMAIN || 'meet.jit.si',
      createdAt: room.createdAt,
      closedAt: room.closedAt,
      section: room.section,
    };
  }

  /**
   * Generate a join token for a user.
   * Validates enrollment for parents/children, ownership for teachers.
   */
  async getJoinToken(userId: string, sectionId: string) {
    const room = await this.videoRepository.findBySectionId(sectionId);
    if (!room) {
      throw new NotFoundException('Video room not found for this section');
    }

    if (room.status === 'CLOSED') {
      throw new BadRequestException('This video room has been closed');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let isModerator = false;

    if (user.role === 'TEACHER') {
      // Verify teacher owns this section
      const section = await this.prisma.section.findUnique({
        where: { id: sectionId },
        include: { class: { include: { teacher: true } } },
      });

      if (!section || section.class.teacher.userId !== userId) {
        throw new ForbiddenException('You do not own this class');
      }
      isModerator = true;
    } else if (user.role === 'PARENT') {
      // Verify at least one child is enrolled in this section
      const children = await this.prisma.child.findMany({
        where: { parentId: userId },
        select: { id: true },
      });
      const childIds = children.map((c) => c.id);

      if (childIds.length === 0) {
        throw new ForbiddenException('No children registered');
      }

      const enrollment = await this.prisma.enrollment.findFirst({
        where: {
          childId: { in: childIds },
          sectionId,
          status: { in: ['CONFIRMED', 'ACTIVE'] },
        },
      });

      if (!enrollment) {
        throw new ForbiddenException(
          'Enrollment required: none of your children are enrolled in this section',
        );
      }

      // Queue parent notification that child is joining
      if (this.notificationQueue) {
        await this.notificationQueue.add('child-join-notification', {
          userId,
          channel: 'push',
          title: 'Ребёнок присоединился к занятию',
          body: `Ваш ребёнок присоединяется к видео-занятию в секции.`,
          data: { sectionId, roomName: room.roomName },
        });
      }
    } else if (user.role === 'ADMIN') {
      isModerator = true;
    } else {
      throw new ForbiddenException('Access denied');
    }

    // Mark room as ACTIVE on first join
    if (room.status === 'WAITING') {
      await this.videoRepository.updateStatus(sectionId, {
        status: 'ACTIVE',
      });
    }

    const jwt = this.generateJitsiJwt({
      room: room.roomName,
      sub: userId,
      name: user.name,
      moderator: isModerator,
      userId,
    });

    return {
      roomName: room.roomName,
      jitsiDomain: process.env.JITSI_DOMAIN || 'meet.jit.si',
      jwt,
      moderator: isModerator,
      status: room.status === 'WAITING' ? 'ACTIVE' : room.status,
    };
  }

  /**
   * Close a video room. Teacher or admin only.
   */
  async closeRoom(userId: string, sectionId: string) {
    const room = await this.videoRepository.findBySectionId(sectionId);
    if (!room) {
      throw new NotFoundException('Video room not found for this section');
    }

    if (room.status === 'CLOSED') {
      return { message: 'Room is already closed' };
    }

    // Verify authorization
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.role === 'TEACHER') {
      const section = await this.prisma.section.findUnique({
        where: { id: sectionId },
        include: { class: { include: { teacher: true } } },
      });
      if (!section || section.class.teacher.userId !== userId) {
        throw new ForbiddenException('You do not own this class');
      }
    } else if (user?.role !== 'ADMIN') {
      throw new ForbiddenException('Only the teacher or admin can close a room');
    }

    await this.videoRepository.updateStatus(sectionId, {
      status: 'CLOSED',
      closedAt: new Date(),
    });

    return { message: 'Room closed successfully' };
  }

  /**
   * Auto-close endpoint (called by the worker, no auth).
   */
  async autoCloseRoom(sectionId: string) {
    const room = await this.videoRepository.findBySectionId(sectionId);
    if (!room) {
      return; // Room was already deleted, nothing to do
    }

    if (room.status === 'CLOSED') {
      return; // Already closed
    }

    await this.videoRepository.updateStatus(sectionId, {
      status: 'CLOSED',
      closedAt: new Date(),
    });
  }
}
