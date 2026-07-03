import type { AuditLogListResult, ListAuditLogsRecord } from './audit.types';

export abstract class AuditRepository {
  abstract list(input: ListAuditLogsRecord): Promise<AuditLogListResult>;
}
