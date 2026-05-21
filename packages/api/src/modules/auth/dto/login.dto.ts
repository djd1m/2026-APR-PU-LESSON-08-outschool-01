import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Некорректный email адрес' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Пароль должен содержать минимум 8 символов' })
  @MaxLength(100, { message: 'Пароль не должен превышать 100 символов' })
  password!: string;
}
