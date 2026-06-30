import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MaxLength(1024)
  password!: string;
}
