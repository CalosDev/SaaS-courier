import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import { CurrentSession } from '../auth/http/current-session.decorator';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import type { SessionContext } from '../sessions/session.types';
import { QuoteRateCardDto } from './dto/quote-rate-card.dto';
import { RatesService } from './rates.service';

@Controller('rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Post('quote')
  @RequirePermissions('rates.read')
  @HttpCode(200)
  async quote(
    @CurrentSession() session: SessionContext,
    @Body() body: QuoteRateCardDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');

    const quote = await this.ratesService.quote(session.organizationId, body);

    return {
      rateCard: {
        id: quote.rateCard.id,
        service: quote.rateCard.service,
        name: quote.rateCard.name,
        segmentKey: quote.rateCard.segmentKey,
        segmentName: quote.rateCard.segmentName,
        calculationType: quote.rateCard.calculationType,
        version: quote.rateCard.version,
        status: quote.rateCard.status,
        currencyCode: quote.rateCard.currencyCode,
        weightUnit: quote.rateCard.weightUnit,
      },
      appliedRule: {
        id: quote.appliedRule.id,
        sortOrder: quote.appliedRule.sortOrder,
        minWeight: quote.appliedRule.minWeight,
        maxWeight: quote.appliedRule.maxWeight,
        flatAmountMinor: quote.appliedRule.flatAmountMinor?.toString() ?? null,
        unitAmountMinor: quote.appliedRule.unitAmountMinor?.toString() ?? null,
      },
      quote: {
        weight: quote.weight,
        pieceCount: quote.pieceCount,
        courierAmountMinor: quote.courierAmountMinor.toString(),
        customsAmountMinor: quote.customsAmountMinor.toString(),
        totalAmountMinor: quote.totalAmountMinor.toString(),
      },
    };
  }
}
