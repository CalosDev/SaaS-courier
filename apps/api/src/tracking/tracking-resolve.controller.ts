import { Controller, Get, Param, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../auth/http/public.decorator';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';
import { TrackingService } from './tracking.service';

@Controller()
export class TrackingResolveController {
  constructor(private readonly trackingService: TrackingService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('public/organizations/:slug/tracking/:reference')
  resolvePublic(
    @Param('slug') slug: string,
    @Param('reference') reference: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.trackingService.resolvePublic(slug, reference);
  }

  @Get('tracking/resolve/:reference')
  resolveAuthenticated(
    @CurrentCommandContext() context: CommandContext,
    @Param('reference') reference: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.trackingService.resolveAuthenticated(context, reference);
  }
}
