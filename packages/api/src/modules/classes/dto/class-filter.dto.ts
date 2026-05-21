import { IsString, IsNumber, IsOptional, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { MIN_AGE, MAX_AGE, MIN_CLASS_PRICE, MAX_CLASS_PRICE } from '@klassmarket/shared';

export type ClassSortOption = 'rating' | 'price_asc' | 'price_desc' | 'newest';

export class ClassFilterDto {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(MIN_AGE)
  @Max(MAX_AGE)
  ageMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(MIN_AGE)
  @Max(MAX_AGE)
  ageMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(MIN_CLASS_PRICE)
  priceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Max(MAX_CLASS_PRICE)
  priceMax?: number;

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  @IsIn(['rating', 'price_asc', 'price_desc', 'newest'])
  sort?: ClassSortOption;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}
