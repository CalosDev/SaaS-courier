import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../auth/http/public.decorator';
import { SkipCsrf } from '../auth/http/skip-csrf.decorator';
import { CarrierConnectionsService } from './carrier-connections.service';
import { CarrierWebhookDto } from './dto/carrier-webhook.dto';

@Public()
@SkipCsrf()
@Controller('webhooks/carriers')
export class CarrierWebhooksController {
  constructor(private readonly carriers: CarrierConnectionsService) {}

  @Post(':connectionKey')
  @HttpCode(202)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  receive(
    @Param('connectionKey') connectionKey: string,
    @Headers('x-carrier-event-id') eventId: string,
    @Headers('x-carrier-timestamp') timestamp: string,
    @Headers('x-carrier-signature') signature: string,
    @Body() body: CarrierWebhookDto,
  ) {
    if (!eventId || !timestamp || !signature) {
      throw new BadRequestException('Carrier webhook headers are required');
    }
    return this.carriers.receiveWebhook({
      connectionKey,
      eventId,
      timestamp,
      signature,
      body,
    });
  }
}
