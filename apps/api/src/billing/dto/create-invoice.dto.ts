import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { InvoiceLineType } from '../../generated/prisma/client';

export class CreateInvoiceLineDto {
  @IsEnum(InvoiceLineType)
  type: InvoiceLineType;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  unitPriceMinor: string;
}

export class CreateInvoiceDto {
  @IsUUID()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  currencyCode: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineDto)
  lines: CreateInvoiceLineDto[];
}
