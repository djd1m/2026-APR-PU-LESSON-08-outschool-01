import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@klassmarket/shared';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() body: { enrollmentId: string }) {
    return this.paymentsService.createForEnrollment(body.enrollmentId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.findById(id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAll(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.paymentsService.findAll(
      page ? parseInt(page, 10) : 1,
      perPage ? parseInt(perPage, 10) : 20,
    );
  }

  @Post('webhook/yookassa')
  async yookassaWebhook(
    @Body() body: { object: { id: string; status: string } },
    @Req() req: any,
  ) {
    const rawBody = JSON.stringify(req.body);
    const signature = req.headers['x-yookassa-signature'] as string | undefined;
    return this.paymentsService.handleWebhook(
      rawBody,
      signature,
      body.object.id,
      body.object.status,
    );
  }
}
