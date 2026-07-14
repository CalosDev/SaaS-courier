import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { CurrentSession } from '../auth/http/current-session.decorator';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import type { SessionContext } from '../sessions/session.types';
import { CarrierConnectionsService } from './carrier-connections.service';
import { CreateCarrierConnectionDto } from './dto/create-carrier-connection.dto';
import { UpdateCarrierConnectionDto } from './dto/update-carrier-connection.dto';

@Controller('carrier-connections')
export class CarrierConnectionsController {
  constructor(private readonly carriers: CarrierConnectionsService) {}

  @Get()
  @RequirePermissions('carriers.read')
  list(
    @CurrentSession() session: SessionContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.carriers.list(session.organizationId);
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('carriers.manage')
  create(
    @CurrentCommandContext() context: CommandContext,
    @Body() body: CreateCarrierConnectionDto,
  ) {
    return this.carriers.create(context, body);
  }

  @Patch(':connectionId')
  @RequirePermissions('carriers.manage')
  update(
    @CurrentCommandContext() context: CommandContext,
    @Param('connectionId', new ParseUUIDPipe({ version: '4' }))
    connectionId: string,
    @Body() body: UpdateCarrierConnectionDto,
  ) {
    return this.carriers.update(context, connectionId, body);
  }

  @Post(':connectionId/test')
  @HttpCode(200)
  @RequirePermissions('carriers.manage')
  test(
    @CurrentCommandContext() context: CommandContext,
    @Param('connectionId', new ParseUUIDPipe({ version: '4' }))
    connectionId: string,
  ) {
    return this.carriers.test(context, connectionId);
  }
}
