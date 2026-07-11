import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateMawbDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  mawb!: string;
}
