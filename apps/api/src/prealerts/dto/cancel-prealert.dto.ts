import { IsString, MaxLength, MinLength } from 'class-validator';

export class CancelPrealertDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
