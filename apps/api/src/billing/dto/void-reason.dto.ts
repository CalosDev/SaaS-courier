import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VoidReasonDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
