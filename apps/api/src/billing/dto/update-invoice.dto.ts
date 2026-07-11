import { Type } from 'class-transformer';
import {
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateInvoiceLineDto } from './create-invoice.dto';

export class UpdateInvoiceDto {
  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineDto)
  lines?: CreateInvoiceLineDto[];
}
