import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { CurrentSession } from '../auth/http/current-session.decorator';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import type { SessionContext } from '../sessions/session.types';
import { ReceivePackageDto } from './dto/receive-package.dto';
import type { PackageReceptionRecord } from './package-reception.types';
import { PackageReceptionsService } from './package-receptions.service';

@Controller('packages')
export class PackageReceptionsController {
  constructor(private readonly service: PackageReceptionsService) {}

  @Post(':packageId/receive')
  @RequirePermissions('packages.receive')
  @HttpCode(200)
  async receive(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Param('packageId', new ParseUUIDPipe({ version: '4' })) packageId: string,
    @Body() body: ReceivePackageDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);
    const reception = await this.service.receive(
      session.organizationId,
      packageId,
      body,
      context,
    );

    return this.serialize(reception);
  }

  @Get(':packageId/reception')
  @RequirePermissions('packages.read')
  async get(
    @CurrentSession() session: SessionContext,
    @Param('packageId', new ParseUUIDPipe({ version: '4' })) packageId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);
    const reception = await this.service.get(session.organizationId, packageId);

    return this.serialize(reception);
  }

  private setNoStore(response: Response): void {
    response.setHeader('Cache-Control', 'no-store');
  }

  private serialize(reception: PackageReceptionRecord) {
    return {
      id: reception.id,
      packageId: reception.packageId,
      facility: reception.facility,
      receivedBy: reception.receivedBy,
      weight: reception.weight,
      weightUnit: reception.weightUnit,
      length: reception.length,
      width: reception.width,
      height: reception.height,
      dimensionUnit: reception.dimensionUnit,
      pieceCount: reception.pieceCount,
      condition: reception.condition,
      receivedAt: reception.receivedAt.toISOString(),
      createdAt: reception.createdAt.toISOString(),
    };
  }
}
