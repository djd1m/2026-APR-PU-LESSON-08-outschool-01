import { IsString, MinLength, IsDateString, IsArray } from 'class-validator';

export class CreateChildDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsDateString()
  birthDate: string;

  @IsArray()
  @IsString({ each: true })
  interests: string[];
}
