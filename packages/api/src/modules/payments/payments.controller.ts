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
  BadRequestException,
  RawBodyRequest,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@klassmarket/shared';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { Request } from 'express';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  /**
   * POST /payments/checkout
   * Create a payment for an enrollment — returns ЮKassa confirmation_url.
   */
  @Post('checkout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARENT)
  async checkout(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.paymentsService.createCheckout(userId, dto.enrollmentId);
  }

  /**
   * POST /payments/webhook
   * Handle ЮKassa webhook (payment.succeeded, payment.canceled, refund.succeeded).
   * No auth guard — ЮKassa calls this endpoint directly.
   */
  @Post('webhook')
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Body()
    body: {
      type: string;
      event: string;
      object: { id: string; status: string; payment_id?: string };
    },
  ) {
    // Verify webhook signature
    const signature = req.headers['x-yookassa-signature'] as
      | string
      | undefined;
    const rawBody =
      typeof req.rawBody === 'string'
        ? req.rawBody
        : req.rawBody?.toString('utf-8') ?? JSON.stringify(body);

    if (!this.paymentsService.verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    return this.paymentsService.handleWebhook(body);
  }

  /**
   * GET /payments
   * List the current parent's payment history.
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARENT)
  async list(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.paymentsService.getParentPayments(
      userId,
      page ? parseInt(page, 10) : 1,
      perPage ? parseInt(perPage, 10) : 20,
    );
  }

  /**
   * GET /payments/admin
   * Admin-only: list all payments.
   */
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async listAll(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.paymentsService.findAll(
      page ? parseInt(page, 10) : 1,
      perPage ? parseInt(perPage, 10) : 20,
    );
  }

  /**
   * GET /payments/teacher/earnings
   * Teacher's earnings summary: total earned, pending payout, withdrawn.
   */
  @Get('teacher/earnings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  async earnings(@CurrentUser('id') userId: string) {
    return this.paymentsService.getEarnings(userId);
  }

  /**
   * POST /payments/teacher/withdraw
   * Request a teacher payout (min 1000 RUB).
   */
  @Post('teacher/withdraw')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  async withdraw(
    @CurrentUser('id') userId: string,
    @Body() dto: WithdrawDto,
  ) {
    return this.paymentsService.requestWithdraw(userId, dto.amount);
  }

  /**
   * GET /payments/:id
   * Get a single payment's details.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.findById(id);
  }

  /**
   * POST /payments/:id/refund
   * Request refund (parent, before class starts).
   */
  @Post(':id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARENT)
  async refund(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentsService.refund(userId, id);
  }
}
