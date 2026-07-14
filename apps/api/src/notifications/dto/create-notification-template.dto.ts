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

export const NOTIFICATION_VARIABLES = [
  'organizationName',
  'customerCode',
  'trackingNumber',
  'status',
  'eventType',
] as const;

export class CreateNotificationTemplateDto {
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9_]{2,79}$/)
  code!: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9_.]{2,119}$/)
  eventType!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(240)
  subjectTemplate!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  bodyTemplate!: string;

  @IsArray()
  @ArrayMaxSize(NOTIFICATION_VARIABLES.length)
  @IsIn(NOTIFICATION_VARIABLES, { each: true })
  allowedVariables!: (typeof NOTIFICATION_VARIABLES)[number][];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
