import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { EMPLOYEE_STATUS_VALUES } from '../employee.types';

export class ListEmployeesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsIn(EMPLOYEE_STATUS_VALUES)
  status?: (typeof EMPLOYEE_STATUS_VALUES)[number];

  @IsOptional()
  @IsUUID('4')
  facilityId?: string;

  @IsOptional()
  @IsUUID('4')
  roleId?: string;
}
