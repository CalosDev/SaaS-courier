import { BadRequestException, Injectable } from '@nestjs/common';

import { AuditRepository } from './audit.repository';
import type { AuditLogListResult, ListAuditLogsInput } from './audit.types';

const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  async list(
    organizationId: string,
    input: ListAuditLogsInput,
  ): Promise<AuditLogListResult> {
    const occurredFrom = input.occurredFrom
      ? new Date(input.occurredFrom)
      : undefined;
    const occurredTo = input.occurredTo
      ? new Date(input.occurredTo)
      : undefined;

    if (
      occurredFrom &&
      occurredTo &&
      (occurredTo < occurredFrom ||
        occurredTo.getTime() - occurredFrom.getTime() > MAX_RANGE_MS)
    ) {
      throw new BadRequestException(
        'Audit date range must be ordered and cannot exceed 90 days',
      );
    }

    return this.auditRepository.list({
      organizationId,
      page: input.page ?? 1,
      pageSize: input.pageSize ?? 20,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorEmployeeId: input.actorEmployeeId,
      source: input.source,
      occurredFrom,
      occurredTo,
      correlationId: input.correlationId,
    });
  }
}
