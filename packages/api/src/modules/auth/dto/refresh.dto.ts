import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshDto {
  @IsString({ message: 'refreshToken должен быть строкой' })
  @IsNotEmpty({ message: 'refreshToken обязателен' })
  refreshToken!: string;
}
