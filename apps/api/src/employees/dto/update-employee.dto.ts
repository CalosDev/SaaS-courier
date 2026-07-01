import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { EMPLOYEE_STATUS_VALUES } from '../employee.types';

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  employeeCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsIn(EMPLOYEE_STATUS_VALUES)
  status?: (typeof EMPLOYEE_STATUS_VALUES)[number];
}
