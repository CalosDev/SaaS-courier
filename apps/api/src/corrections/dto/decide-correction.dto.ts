import { IsOptional, IsString } from 'class-validator';

export class DecideCorrectionDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
