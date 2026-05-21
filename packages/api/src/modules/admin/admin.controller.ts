import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@klassmarket/shared';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  async getStats() {
    return this.adminService.getPlatformStats();
  }

  @Get('pending-classes')
  async getPendingClasses(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.adminService.getPendingClasses(
      page ? parseInt(page, 10) : 1,
      perPage ? parseInt(perPage, 10) : 20,
    );
  }

  @Get('flagged-reviews')
  async getFlaggedReviews(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.adminService.getFlaggedReviews(
      page ? parseInt(page, 10) : 1,
      perPage ? parseInt(perPage, 10) : 20,
    );
  }

  @Post('classes/:id/approve')
  async approveClass(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.approveClass(id);
  }

  @Post('classes/:id/reject')
  async rejectClass(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.rejectClass(id);
  }

  @Post('teachers/:id/verify')
  async verifyTeacher(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.verifyTeacher(id);
  }

  @Post('teachers/:id/reject')
  async rejectTeacher(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.rejectTeacher(id);
  }
}
