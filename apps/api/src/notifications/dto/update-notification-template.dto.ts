import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { NOTIFICATION_VARIABLES } from './create-notification-template.dto';

export class UpdateNotificationTemplateDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_.]{2,119}$/)
  eventType?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  subjectTemplate?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  bodyTemplate?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(NOTIFICATION_VARIABLES.length)
  @IsIn(NOTIFICATION_VARIABLES, { each: true })
  allowedVariables?: (typeof NOTIFICATION_VARIABLES)[number][];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
