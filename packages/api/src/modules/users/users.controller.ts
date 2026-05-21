import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@klassmarket/shared';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser('id') userId: string) {
    return this.usersService.findById(userId);
  }

  @Get('dashboard')
  async getDashboard(@CurrentUser('id') userId: string) {
    return this.usersService.getParentDashboard(userId);
  }

  @Get('teacher/dashboard')
  @Roles(UserRole.TEACHER)
  async getTeacherDashboard(@CurrentUser('id') userId: string) {
    return this.usersService.getTeacherDashboard(userId);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  async findAll(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.usersService.findAll(
      page ? parseInt(page, 10) : 1,
      perPage ? parseInt(perPage, 10) : 20,
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() body: { name?: string; phone?: string; avatarUrl?: string },
  ) {
    return this.usersService.update(userId, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.delete(id);
  }
}
