import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class VideoRepository {
  constructor(private prisma: PrismaService) {}

  async createRoom(data: Prisma.VideoRoomCreateInput) {
    return this.prisma.videoRoom.create({
      data,
      include: { section: { include: { class: true } } },
    });
  }

  async findBySectionId(sectionId: string) {
    return this.prisma.videoRoom.findUnique({
      where: { sectionId },
      include: { section: { include: { class: true } } },
    });
  }

  async findByRoomName(roomName: string) {
    return this.prisma.videoRoom.findUnique({
      where: { roomName },
    });
  }

  async updateStatus(
    sectionId: string,
    data: Prisma.VideoRoomUpdateInput,
  ) {
    return this.prisma.videoRoom.update({
      where: { sectionId },
      data,
    });
  }

  async deleteRoom(sectionId: string) {
    return this.prisma.videoRoom.delete({
      where: { sectionId },
    });
  }
}
