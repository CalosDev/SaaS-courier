import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';
import { AuditService } from './audit.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('audit.read')
  async list(
    @CurrentCommandContext() context: CommandContext,
    @Query() query: ListAuditLogsDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    const result = await this.auditService.list(context.organizationId, query);

    return {
      items: result.items.map((item) => ({
        ...item,
        occurredAt: item.occurredAt.toISOString(),
      })),
      pagination: result.pagination,
    };
  }
}
