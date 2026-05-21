import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
  IsIn,
} from 'class-validator';
import { UserRole } from '@klassmarket/shared';

export class RegisterDto {
  @IsEmail({}, { message: 'Некорректный email адрес' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Пароль должен содержать минимум 8 символов' })
  @MaxLength(100, { message: 'Пароль не должен превышать 100 символов' })
  password!: string;

  @IsString()
  @MinLength(2, { message: 'Имя должно содержать минимум 2 символа' })
  @MaxLength(100, { message: 'Имя не должно превышать 100 символов' })
  name!: string;

  @IsOptional()
  @IsEnum(UserRole, { message: 'Некорректная роль' })
  @IsIn([UserRole.PARENT, UserRole.TEACHER], {
    message: 'Роль может быть только PARENT или TEACHER',
  })
  role?: UserRole;
}
