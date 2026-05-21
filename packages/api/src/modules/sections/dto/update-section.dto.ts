import {
  IsDateString,
  IsInt,
  IsString,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class UpdateSectionDto {
  @IsDateString()
  @IsOptional()
  startTime?: string;

  @IsInt()
  @Min(15)
  @Max(180)
  @IsOptional()
  durationMinutes?: number;

  @IsString()
  @IsOptional()
  timezone?: string;
}
