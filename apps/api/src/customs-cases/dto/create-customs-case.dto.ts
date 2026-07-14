import { IsNotEmpty, IsString, MaxLength, Matches } from 'class-validator';

export class CreateCustomsCaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._\-/ ]*$/)
  caseNumber!: string;
}
