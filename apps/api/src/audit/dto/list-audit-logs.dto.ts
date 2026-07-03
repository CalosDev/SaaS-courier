import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../audit.catalog';

export class ListAuditLogsDto {
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
  @IsIn(AUDIT_ACTIONS)
  action?: (typeof AUDIT_ACTIONS)[number];

  @IsOptional()
  @IsIn(AUDIT_ENTITY_TYPES)
  entityType?: (typeof AUDIT_ENTITY_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(128)
  entityId?: string;

  @IsOptional()
  @IsUUID('4')
  actorEmployeeId?: string;

  @IsOptional()
  @IsIn(['HTTP', 'JOB', 'IMPORT', 'SYSTEM'])
  source?: 'HTTP' | 'JOB' | 'IMPORT' | 'SYSTEM';

  @IsOptional()
  @IsISO8601({ strict: true })
  occurredFrom?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  occurredTo?: string;

  @IsOptional()
  @Matches(/^[A-Za-z0-9._:-]{1,100}$/)
  correlationId?: string;
}
