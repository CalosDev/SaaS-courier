import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCourierServiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
