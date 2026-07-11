import { IsString, MaxLength } from 'class-validator';

export class CreateCustomsCaseDto {
  @IsString()
  @MaxLength(120)
  caseNumber!: string;
}
