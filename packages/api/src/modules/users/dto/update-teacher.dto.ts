import {
  IsString,
  IsArray,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class UpdateTeacherDto {
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  bio?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  education?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  subjects?: string[];

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  experience?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;
}
