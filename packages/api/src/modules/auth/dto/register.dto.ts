import { IsEmail, IsString, MinLength, MaxLength, IsIn, IsOptional } from 'class-validator';
import { UserRole } from '@klassmarket/shared';

export class RegisterDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Пароль минимум 8 символов' })
  @MaxLength(100)
  password!: string;

  @IsString()
  @MinLength(2, { message: 'Имя минимум 2 символа' })
  @MaxLength(100)
  name!: string;

  @IsIn([UserRole.PARENT, UserRole.TEACHER], {
    message: 'Роль может быть только PARENT или TEACHER',
  })
  @IsOptional()
  role?: UserRole.PARENT | UserRole.TEACHER;
}
