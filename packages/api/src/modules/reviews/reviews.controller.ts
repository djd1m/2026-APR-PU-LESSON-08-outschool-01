import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@klassmarket/shared';

@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(userId, dto);
  }

  @Get()
  async findAll(
    @Query('classId') classId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const pp = perPage ? parseInt(perPage, 10) : 20;

    if (classId) {
      return this.reviewsService.findByClass(classId, p, pp);
    }
    if (teacherId) {
      return this.reviewsService.findByTeacher(teacherId, p, pp);
    }
    return this.reviewsService.findByClass('', p, pp);
  }

  @Get('class/:classId')
  async findByClass(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.reviewsService.findByClass(
      classId,
      page ? parseInt(page, 10) : 1,
      perPage ? parseInt(perPage, 10) : 20,
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewsService.findById(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewsService.delete(id);
  }

  @Post(':id/flag')
  @UseGuards(JwtAuthGuard)
  async flag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ) {
    return this.reviewsService.flagForModeration(id, body.reason);
  }
}
