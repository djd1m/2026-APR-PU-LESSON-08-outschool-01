import {
  IsString,
  IsNumber,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsOptional,
  IsIn,
} from 'class-validator';
import {
  MIN_CLASS_PRICE,
  MAX_CLASS_PRICE,
  MIN_AGE,
  MAX_AGE,
  MAX_CLASS_SIZE,
} from '@klassmarket/shared';

const VALID_SUBJECTS = [
  'Математика',
  'Программирование',
  'Английский язык',
  'Рисование',
  'Музыка',
  'Наука',
  'Робототехника',
];

export class CreateClassDto {
  @IsString()
  @MinLength(5, { message: 'Название должно быть не менее 5 символов' })
  @MaxLength(120, { message: 'Название должно быть не более 120 символов' })
  title!: string;

  @IsString()
  @MinLength(20, { message: 'Описание должно быть не менее 20 символов' })
  @MaxLength(5000, { message: 'Описание должно быть не более 5000 символов' })
  description!: string;

  @IsString()
  @IsIn(VALID_SUBJECTS, { message: 'Некорректный предмет' })
  subject!: string;

  @IsNumber({}, { message: 'Цена должна быть числом' })
  @Min(MIN_CLASS_PRICE, { message: `Минимальная цена — ${MIN_CLASS_PRICE} ₽` })
  @Max(MAX_CLASS_PRICE, { message: `Максимальная цена — ${MAX_CLASS_PRICE} ₽` })
  price!: number;

  @IsNumber({}, { message: 'Минимальный возраст должен быть числом' })
  @Min(MIN_AGE, { message: `Минимальный возраст — ${MIN_AGE} лет` })
  @Max(MAX_AGE, { message: `Максимальный возраст — ${MAX_AGE} лет` })
  ageMin!: number;

  @IsNumber({}, { message: 'Максимальный возраст должен быть числом' })
  @Min(MIN_AGE, { message: `Минимальный возраст — ${MIN_AGE} лет` })
  @Max(MAX_AGE, { message: `Максимальный возраст — ${MAX_AGE} лет` })
  ageMax!: number;

  @IsNumber({}, { message: 'Количество учеников должно быть числом' })
  @Min(1, { message: 'Минимум 1 ученик' })
  @Max(MAX_CLASS_SIZE, { message: `Максимум ${MAX_CLASS_SIZE} учеников` })
  @IsOptional()
  maxStudents?: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;
}
