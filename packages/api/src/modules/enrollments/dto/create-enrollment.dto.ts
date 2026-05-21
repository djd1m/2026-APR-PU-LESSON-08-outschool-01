import { IsUUID } from 'class-validator';

export class CreateEnrollmentDto {
  @IsUUID()
  childId: string;

  @IsUUID()
  sectionId: string;
}
