import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { VideoService } from './video.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@klassmarket/shared';

@Controller('video')
export class VideoController {
  constructor(private videoService: VideoService) {}

  /**
   * POST /video/rooms
   * Create a video room for a section. Teacher only.
   * Auto-schedules a BullMQ delayed job to close 10min after section endTime.
   */
  @Post('rooms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  async createRoom(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRoomDto,
  ) {
    return this.videoService.createRoom(userId, dto.sectionId);
  }

  /**
   * GET /video/rooms/:sectionId
   * Get room info and status. Requires authentication.
   */
  @Get('rooms/:sectionId')
  @UseGuards(JwtAuthGuard)
  async getRoomInfo(
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
  ) {
    return this.videoService.getRoomInfo(sectionId);
  }

  /**
   * POST /video/rooms/:sectionId/join
   * Generate a JWT for joining the Jitsi room.
   * Validates enrollment for parents, ownership for teachers.
   */
  @Post('rooms/:sectionId/join')
  @UseGuards(JwtAuthGuard)
  async joinRoom(
    @CurrentUser('id') userId: string,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
  ) {
    return this.videoService.getJoinToken(userId, sectionId);
  }

  /**
   * DELETE /video/rooms/:sectionId
   * Close a video room. Teacher or admin only.
   */
  @Delete('rooms/:sectionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async closeRoom(
    @CurrentUser('id') userId: string,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
  ) {
    return this.videoService.closeRoom(userId, sectionId);
  }

  /**
   * POST /video/rooms/:sectionId/auto-close
   * Internal endpoint called by the BullMQ worker.
   * No JWT auth — should be restricted to internal network in production.
   */
  @Post('rooms/:sectionId/auto-close')
  async autoClose(
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
  ) {
    return this.videoService.autoCloseRoom(sectionId);
  }
}
