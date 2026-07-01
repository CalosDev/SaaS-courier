import { IsString, MaxLength } from 'class-validator';

export class ActivateAccountDto {
  @IsString()
  @MaxLength(255)
  activationToken!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}
