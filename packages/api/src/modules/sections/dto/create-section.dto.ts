import {
  IsUUID,
  IsDateString,
  IsInt,
  IsString,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class CreateSectionDto {
  @IsUUID()
  classId!: string;

  @IsDateString()
  startTime!: string;

  @IsInt()
  @Min(15)
  @Max(180)
  durationMinutes!: number;

  @IsString()
  @IsOptional()
  timezone?: string;
}
