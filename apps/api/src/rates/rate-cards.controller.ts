import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { CurrentSession } from '../auth/http/current-session.decorator';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import type { SessionContext } from '../sessions/session.types';
import { CreateRateCardDto } from './dto/create-rate-card.dto';
import { ListRateCardsDto } from './dto/list-rate-cards.dto';
import { ReplaceRateRulesDto } from './dto/replace-rate-rules.dto';
import { UpdateRateCardDto } from './dto/update-rate-card.dto';
import { RatesService } from './rates.service';
import type {
  RateCardListResult,
  RateCardRecord,
  RateRuleRecord,
} from './rates.types';

@Controller('rate-cards')
export class RateCardsController {
  constructor(private readonly ratesService: RatesService) {}

  @Get()
  @RequirePermissions('rates.read')
  async listRateCards(
    @CurrentSession() session: SessionContext,
    @Query() query: ListRateCardsDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    return this.serializeRateCardList(
      await this.ratesService.listRateCards(session.organizationId, query),
    );
  }

  @Post()
  @RequirePermissions('rates.manage')
  @HttpCode(201)
  async createRateCard(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Body() body: CreateRateCardDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    return this.serializeRateCard(
      await this.ratesService.createRateCard(
        session.organizationId,
        body,
        context,
      ),
    );
  }

  @Get(':rateCardId')
  @RequirePermissions('rates.read')
  async getRateCard(
    @CurrentSession() session: SessionContext,
    @Param('rateCardId', new ParseUUIDPipe({ version: '4' }))
    rateCardId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    return this.serializeRateCard(
      await this.ratesService.getRateCardById(
        session.organizationId,
        rateCardId,
      ),
    );
  }

  @Patch(':rateCardId')
  @RequirePermissions('rates.manage')
  async updateRateCard(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Param('rateCardId', new ParseUUIDPipe({ version: '4' }))
    rateCardId: string,
    @Body() body: UpdateRateCardDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    return this.serializeRateCard(
      await this.ratesService.updateRateCard(
        session.organizationId,
        rateCardId,
        body,
        context,
      ),
    );
  }

  @Put(':rateCardId/rules')
  @RequirePermissions('rates.manage')
  async replaceRateRules(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Param('rateCardId', new ParseUUIDPipe({ version: '4' }))
    rateCardId: string,
    @Body() body: ReplaceRateRulesDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    return this.serializeRateCard(
      await this.ratesService.replaceRateRules(
        session.organizationId,
        rateCardId,
        body,
        context,
      ),
    );
  }

  @Post(':rateCardId/activate')
  @RequirePermissions('rates.manage')
  @HttpCode(200)
  async activateRateCard(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Param('rateCardId', new ParseUUIDPipe({ version: '4' }))
    rateCardId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    return this.serializeRateCard(
      await this.ratesService.activateRateCard(
        session.organizationId,
        rateCardId,
        context,
      ),
    );
  }

  private setNoStore(response: Response): void {
    response.setHeader('Cache-Control', 'no-store');
  }

  private serializeRateCardList(result: RateCardListResult) {
    return {
      items: result.items.map((item) => this.serializeRateCard(item)),
      pagination: result.pagination,
    };
  }

  private serializeRateCard(record: RateCardRecord) {
    return {
      id: record.id,
      service: record.service,
      previousRateCardId: record.previousRateCardId,
      name: record.name,
      segmentKey: record.segmentKey,
      segmentName: record.segmentName,
      calculationType: record.calculationType,
      version: record.version,
      status: record.status,
      currencyCode: record.currencyCode,
      weightUnit: record.weightUnit,
      effectiveFrom: record.effectiveFrom?.toISOString() ?? null,
      effectiveTo: record.effectiveTo?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      rules: record.rules.map((rule) => this.serializeRule(rule)),
    };
  }

  private serializeRule(rule: RateRuleRecord) {
    return {
      id: rule.id,
      sortOrder: rule.sortOrder,
      minWeight: rule.minWeight,
      maxWeight: rule.maxWeight,
      flatAmountMinor: rule.flatAmountMinor?.toString() ?? null,
      unitAmountMinor: rule.unitAmountMinor?.toString() ?? null,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }
}
