import {
  Controller,
  Get,
  Post,
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
import { CreateChildDto } from './dto/create-child.dto';

@Controller()
export class UsersController {
  constructor(private usersService: UsersService) {}

  // --- Teacher profile endpoints (public + authenticated) ---

  @Get('teachers')
  async getTeachers(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('subject') subject?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.getTeachers({
      page: page ? parseInt(page, 10) : 1,
      perPage: perPage ? parseInt(perPage, 10) : 20,
      subject,
      search,
    });
  }

  @Get('teachers/:id')
  async getTeacherProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getTeacherProfile(id);
  }

  @Put('teachers/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  async updateTeacherProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateTeacherDto,
  ) {
    return this.usersService.updateTeacherProfile(userId, dto);
  }

  @Post('teachers/me/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  async submitVerification(@CurrentUser('id') userId: string) {
    return this.usersService.submitVerification(userId);
  }

  // --- Existing user endpoints ---

  @Get('users/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getMe(@CurrentUser('id') userId: string) {
    return this.usersService.findById(userId);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
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

  @Post('children')
  async createChild(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateChildDto,
  ) {
    return this.usersService.createChild(userId, dto);
  }

  @Get('children')
  async getChildren(@CurrentUser('id') userId: string) {
    return this.usersService.getChildren(userId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  @Patch('users/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() body: { name?: string; phone?: string; avatarUrl?: string },
  ) {
    return this.usersService.update(userId, body);
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.delete(id);
  }
}
