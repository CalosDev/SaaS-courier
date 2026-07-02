import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCustomerImportDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsBoolean()
  preserveCustomerCodes!: boolean;

  @IsArray()
  rows!: Record<string, unknown>[];
}
