import { IsString, IsNumber, Min, Max, MinLength, IsOptional } from 'class-validator';
import {
  MIN_CLASS_PRICE,
  MAX_CLASS_PRICE,
  MIN_AGE,
  MAX_AGE,
  MAX_CLASS_SIZE,
} from '@klassmarket/shared';

export class CreateClassDto {
  @IsString()
  @MinLength(5)
  title!: string;

  @IsString()
  @MinLength(20)
  description!: string;

  @IsString()
  subject!: string;

  @IsNumber()
  @Min(MIN_CLASS_PRICE)
  @Max(MAX_CLASS_PRICE)
  price!: number;

  @IsNumber()
  @Min(MIN_AGE)
  @Max(MAX_AGE)
  ageMin!: number;

  @IsNumber()
  @Min(MIN_AGE)
  @Max(MAX_AGE)
  ageMax!: number;

  @IsNumber()
  @Min(1)
  @Max(MAX_CLASS_SIZE)
  @IsOptional()
  maxStudents?: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;
}
