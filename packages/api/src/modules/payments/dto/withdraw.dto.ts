import { IsNumber, Min } from 'class-validator';

export class WithdrawDto {
  /** Minimum withdrawal amount: 1000 RUB */
  @IsNumber()
  @Min(1000)
  amount: number;
}
