import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import type { Response } from 'express';

import { CurrentSession } from '../auth/http/current-session.decorator';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import type { SessionContext } from '../sessions/session.types';
import { CarrierConnectionsService } from './carrier-connections.service';

@Controller('packages/:packageId/carrier-events')
export class PackageCarrierEventsController {
  constructor(private readonly carriers: CarrierConnectionsService) {}

  @Get()
  @RequirePermissions('carriers.read')
  list(
    @CurrentSession() session: SessionContext,
    @Param('packageId', new ParseUUIDPipe({ version: '4' })) packageId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.carriers.listPackageEvents(session.organizationId, packageId);
  }
}
