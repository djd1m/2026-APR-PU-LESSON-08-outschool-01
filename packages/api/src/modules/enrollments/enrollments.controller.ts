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
import { EnrollmentsService } from './enrollments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

@Controller('enrollments')
@UseGuards(JwtAuthGuard)
export class EnrollmentsController {
  constructor(private enrollmentsService: EnrollmentsService) {}

  /**
   * POST /enrollments/trial — book free trial (no payment, one per child per class)
   */
  @Post('trial')
  async createTrial(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateEnrollmentDto,
  ) {
    return this.enrollmentsService.createTrial(userId, dto.childId, dto.sectionId);
  }

  /**
   * POST /enrollments — book paid enrollment
   */
  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateEnrollmentDto,
  ) {
    return this.enrollmentsService.create(userId, dto.childId, dto.sectionId);
  }

  /**
   * GET /enrollments — list parent's enrollments (with class+section info)
   */
  @Get()
  async findMyEnrollments(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.enrollmentsService.findByParent(
      userId,
      page ? parseInt(page, 10) : 1,
      perPage ? parseInt(perPage, 10) : 20,
    );
  }

  /**
   * GET /enrollments/trial-status?childId=...&classId=...
   * Check if trial was already used for a child+class combination.
   */
  @Get('trial-status')
  async trialStatus(
    @Query('childId', ParseUUIDPipe) childId: string,
    @Query('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.enrollmentsService.getTrialStatus(childId, classId);
  }

  /**
   * GET /enrollments/:id — enrollment details
   */
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.enrollmentsService.findById(id, userId);
  }

  @Patch(':id/cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.enrollmentsService.cancel(id, userId);
  }
}
