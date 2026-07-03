import type { AuditActionCode, AuditEntityType } from './audit.catalog';
import type { CommandSource } from '../request-context/request-context.types';

export interface ListAuditLogsInput {
  page?: number;
  pageSize?: number;
  action?: AuditActionCode;
  entityType?: AuditEntityType;
  entityId?: string;
  actorEmployeeId?: string;
  source?: CommandSource;
  occurredFrom?: string;
  occurredTo?: string;
  correlationId?: string;
}

export interface ListAuditLogsRecord {
  organizationId: string;
  page: number;
  pageSize: number;
  action?: AuditActionCode;
  entityType?: AuditEntityType;
  entityId?: string;
  actorEmployeeId?: string;
  source?: CommandSource;
  occurredFrom?: Date;
  occurredTo?: Date;
  correlationId?: string;
}

export interface AuditLogListItem {
  id: string;
  actorType: string;
  actorEmployeeId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  source: string;
  requestId: string;
  correlationId: string;
  changedFields: unknown;
  beforeData: unknown;
  afterData: unknown;
  reason: string | null;
  occurredAt: Date;
}

export interface AuditLogListResult {
  items: AuditLogListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
