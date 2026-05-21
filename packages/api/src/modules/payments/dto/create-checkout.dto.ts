import { IsUUID } from 'class-validator';

export class CreateCheckoutDto {
  @IsUUID()
  enrollmentId: string;
}
