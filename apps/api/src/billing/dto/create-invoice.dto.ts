import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayNotEmpty,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { InvoiceLineType } from '../../generated/prisma/client';

export class CreateInvoiceLineDto {
  @IsEnum(InvoiceLineType)
  type: InvoiceLineType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(0|[1-9]\d*)$/)
  unitPriceMinor: string;
}

export class CreateInvoiceDto {
  @IsUUID()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}$/)
  currencyCode: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineDto)
  lines: CreateInvoiceLineDto[];
}
