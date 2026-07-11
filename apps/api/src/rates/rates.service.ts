import { Inject, Injectable } from '@nestjs/common';

import { OrganizationSettingsService } from '../organization-settings/organization-settings.service';
import type { CommandContext } from '../request-context/request-context.types';
import {
  CourierServiceNotFoundError,
  CourierServiceUnavailableError,
  InvalidRatesInputError,
  RateCardConflictError,
  RateCardNotFoundError,
  RateQuoteConflictError,
} from './rates.errors';
import { RatesRepository } from './rates.repository';
import type {
  CourierServiceListResult,
  CourierServiceRecord,
  CreateCourierServiceInput,
  CreateRateCardInput,
  RateCalculationType,
  RateCardListResult,
  RateCardRecord,
  RateQuoteInput,
  RateQuoteRecord,
  ReplaceRateRulesInput,
  ReplaceRateRuleRecord,
  UpdateCourierServiceInput,
  UpdateRateCardInput,
} from './rates.types';
import {
  RATE_CALCULATION_TYPE_VALUES,
  RATE_CARD_STATUS_VALUES,
} from './rates.types';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,39}$/;

@Injectable()
export class RatesService {
  constructor(
    @Inject(RatesRepository)
    private readonly ratesRepository: RatesRepository,
    private readonly organizationSettingsService: OrganizationSettingsService,
  ) {}

  listServices(
    organizationId: string,
    input: {
      page?: number;
      pageSize?: number;
      q?: string;
      isActive?: boolean;
    },
  ): Promise<CourierServiceListResult> {
    return this.ratesRepository.listServices({
      organizationId: this.requiredText(organizationId, 'organizationId'),
      page: this.page(input.page),
      pageSize: this.pageSize(input.pageSize),
      q: this.optionalText(input.q) ?? undefined,
      isActive: input.isActive,
    });
  }

  async createService(
    organizationId: string,
    input: CreateCourierServiceInput,
    context?: CommandContext,
  ): Promise<CourierServiceRecord> {
    return this.ratesRepository.createService(
      {
        organizationId: this.requiredText(organizationId, 'organizationId'),
        code: this.code(input.code, 'code'),
        name: this.name(input.name, 'name'),
        description: this.optionalLongText(input.description),
        isActive: input.isActive ?? true,
      },
      this.commandContext(context, organizationId),
    );
  }

  async updateService(
    organizationId: string,
    serviceId: string,
    input: UpdateCourierServiceInput,
    context?: CommandContext,
  ): Promise<CourierServiceRecord> {
    const record = {
      organizationId: this.requiredText(organizationId, 'organizationId'),
      serviceId: this.requiredText(serviceId, 'serviceId'),
      ...(input.code !== undefined
        ? { code: this.code(input.code, 'code') }
        : {}),
      ...(input.name !== undefined
        ? { name: this.name(input.name, 'name') }
        : {}),
      ...(input.description !== undefined
        ? { description: this.optionalLongText(input.description) }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    };

    if (Object.keys(record).length === 2) {
      throw new InvalidRatesInputError(
        'Invalid rates input: at least one service field is required',
      );
    }

    const updated = await this.ratesRepository.updateService(
      record,
      this.commandContext(context, organizationId),
    );

    if (!updated) {
      throw new CourierServiceNotFoundError(serviceId);
    }

    return updated;
  }

  listRateCards(
    organizationId: string,
    input: {
      page?: number;
      pageSize?: number;
      q?: string;
      serviceId?: string;
      status?: string;
      segmentKey?: string;
    },
  ): Promise<RateCardListResult> {
    const status =
      input.status !== undefined
        ? this.rateCardStatus(input.status, 'status')
        : undefined;

    return this.ratesRepository.listRateCards({
      organizationId: this.requiredText(organizationId, 'organizationId'),
      page: this.page(input.page),
      pageSize: this.pageSize(input.pageSize),
      q: this.optionalText(input.q) ?? undefined,
      serviceId: this.optionalUuid(input.serviceId, 'serviceId'),
      status,
      segmentKey:
        input.segmentKey !== undefined
          ? this.code(input.segmentKey, 'segmentKey')
          : undefined,
    });
  }

  async getRateCardById(
    organizationId: string,
    rateCardId: string,
  ): Promise<RateCardRecord> {
    const rateCard = await this.ratesRepository.findRateCardById(
      this.requiredText(organizationId, 'organizationId'),
      this.requiredText(rateCardId, 'rateCardId'),
    );

    if (!rateCard) {
      throw new RateCardNotFoundError(rateCardId);
    }

    return rateCard;
  }

  async createRateCard(
    organizationId: string,
    input: CreateRateCardInput,
    context?: CommandContext,
  ): Promise<RateCardRecord> {
    const normalizedOrganizationId = this.requiredText(
      organizationId,
      'organizationId',
    );
    const service = await this.loadService(
      normalizedOrganizationId,
      this.requiredText(input.serviceId, 'serviceId'),
    );
    this.ensureServiceAvailable(service);
    const settings = await this.organizationSettingsService.getCurrent(
      normalizedOrganizationId,
    );

    return this.ratesRepository.createRateCard(
      {
        organizationId: normalizedOrganizationId,
        serviceId: service.id,
        name: this.name(input.name, 'name'),
        segmentKey: this.code(input.segmentKey, 'segmentKey'),
        segmentName: this.name(input.segmentName, 'segmentName'),
        calculationType: this.rateCalculationType(
          input.calculationType,
          'calculationType',
        ),
        currencyCode: settings.organization.currencyCode,
        weightUnit: settings.settings.weightUnit,
      },
      this.commandContext(context, normalizedOrganizationId),
    );
  }

  async updateRateCard(
    organizationId: string,
    rateCardId: string,
    input: UpdateRateCardInput,
    context?: CommandContext,
  ): Promise<RateCardRecord> {
    const normalizedOrganizationId = this.requiredText(
      organizationId,
      'organizationId',
    );

    if (Object.keys(input).length === 0) {
      throw new InvalidRatesInputError(
        'Invalid rates input: at least one rate card field is required',
      );
    }

    if (input.serviceId !== undefined) {
      const service = await this.loadService(
        normalizedOrganizationId,
        this.requiredText(input.serviceId, 'serviceId'),
      );
      this.ensureServiceAvailable(service);
    }

    const settings = await this.organizationSettingsService.getCurrent(
      normalizedOrganizationId,
    );
    const updated = await this.ratesRepository.updateRateCard(
      {
        organizationId: normalizedOrganizationId,
        rateCardId: this.requiredText(rateCardId, 'rateCardId'),
        ...(input.serviceId !== undefined
          ? { serviceId: this.requiredText(input.serviceId, 'serviceId') }
          : {}),
        ...(input.name !== undefined
          ? { name: this.name(input.name, 'name') }
          : {}),
        ...(input.segmentKey !== undefined
          ? { segmentKey: this.code(input.segmentKey, 'segmentKey') }
          : {}),
        ...(input.segmentName !== undefined
          ? { segmentName: this.name(input.segmentName, 'segmentName') }
          : {}),
        ...(input.calculationType !== undefined
          ? {
              calculationType: this.rateCalculationType(
                input.calculationType,
                'calculationType',
              ),
            }
          : {}),
        currencyCode: settings.organization.currencyCode,
        weightUnit: settings.settings.weightUnit,
      },
      this.commandContext(context, normalizedOrganizationId),
    );

    if (!updated) {
      throw new RateCardNotFoundError(rateCardId);
    }

    return updated;
  }

  async replaceRateRules(
    organizationId: string,
    rateCardId: string,
    input: ReplaceRateRulesInput,
    context?: CommandContext,
  ): Promise<RateCardRecord> {
    const normalizedOrganizationId = this.requiredText(
      organizationId,
      'organizationId',
    );
    const current = await this.getRateCardById(
      normalizedOrganizationId,
      rateCardId,
    );
    const normalizedRules = this.normalizeRules(
      current.calculationType,
      input.rules,
    );
    const settings = await this.organizationSettingsService.getCurrent(
      normalizedOrganizationId,
    );
    const updated = await this.ratesRepository.replaceRateRules(
      {
        organizationId: normalizedOrganizationId,
        rateCardId: this.requiredText(rateCardId, 'rateCardId'),
        rules: normalizedRules,
        currencyCode: settings.organization.currencyCode,
        weightUnit: settings.settings.weightUnit,
      },
      this.commandContext(context, normalizedOrganizationId),
    );

    if (!updated) {
      throw new RateCardNotFoundError(rateCardId);
    }

    return updated;
  }

  async activateRateCard(
    organizationId: string,
    rateCardId: string,
    context: CommandContext,
  ): Promise<RateCardRecord> {
    const commandContext = this.requiredCommandContext(context, organizationId);
    const current = await this.getRateCardById(organizationId, rateCardId);
    this.assertExistingRulesCompatible(current);

    const activated = await this.ratesRepository.activateRateCard(
      this.requiredText(organizationId, 'organizationId'),
      this.requiredText(rateCardId, 'rateCardId'),
      commandContext,
    );

    if (!activated) {
      throw new RateCardNotFoundError(rateCardId);
    }

    return activated;
  }

  async quote(
    organizationId: string,
    input: RateQuoteInput,
  ): Promise<RateQuoteRecord> {
    const normalizedOrganizationId = this.requiredText(
      organizationId,
      'organizationId',
    );
    const rateCard = await this.getRateCardById(
      normalizedOrganizationId,
      this.requiredText(input.rateCardId, 'rateCardId'),
    );

    if (rateCard.status !== 'ACTIVE') {
      throw new RateQuoteConflictError('Only active rate cards can be quoted');
    }

    this.ensureServiceAvailable(rateCard.service);

    if (rateCard.rules.length === 0) {
      throw new RateCardConflictError(
        'Active rate card cannot be quoted without rules',
      );
    }

    const weight = this.weight(input.weight, 'weight');
    const pieceCount = this.pieceCount(input.pieceCount);
    const customsAmountMinor = this.moneyMinor(
      input.customsAmountMinor ?? 0,
      'customsAmountMinor',
      { allowZero: true },
    );
    const appliedRule = this.selectRule(rateCard, weight);
    const courierAmountMinor = this.calculateCourierAmount(
      rateCard.calculationType,
      appliedRule,
      weight,
      pieceCount,
    );

    return {
      rateCard,
      appliedRule,
      weight: this.formatScaled(weight, 3),
      pieceCount,
      courierAmountMinor,
      customsAmountMinor,
      totalAmountMinor: courierAmountMinor + customsAmountMinor,
    };
  }

  private normalizeRules(
    calculationType: RateCalculationType,
    rules: ReplaceRateRulesInput['rules'],
  ): ReplaceRateRuleRecord[] {
    if (!Array.isArray(rules) || rules.length === 0) {
      throw new InvalidRatesInputError(
        'Invalid rates input: at least one rate rule is required',
      );
    }

    const normalized = rules.map((rule, index) => ({
      sortOrder:
        rule.sortOrder !== undefined
          ? this.positiveInt(rule.sortOrder, 'sortOrder')
          : index + 1,
      minWeight:
        rule.minWeight === undefined || rule.minWeight === null
          ? null
          : this.decimalText(rule.minWeight, 3, 'minWeight', {
              minInclusive: 0,
            }),
      maxWeight:
        rule.maxWeight === undefined || rule.maxWeight === null
          ? null
          : this.decimalText(rule.maxWeight, 3, 'maxWeight', {
              minExclusive: 0,
            }),
      flatAmountMinor:
        rule.flatAmountMinor === undefined || rule.flatAmountMinor === null
          ? null
          : this.moneyMinor(rule.flatAmountMinor, 'flatAmountMinor', {
              allowZero: true,
            }),
      unitAmountMinor:
        rule.unitAmountMinor === undefined || rule.unitAmountMinor === null
          ? null
          : this.moneyMinor(rule.unitAmountMinor, 'unitAmountMinor'),
    }));

    const sortOrders = new Set<number>();
    for (const rule of normalized) {
      if (sortOrders.has(rule.sortOrder)) {
        throw new InvalidRatesInputError(
          'Invalid rates input: duplicate sortOrder is not allowed',
        );
      }

      sortOrders.add(rule.sortOrder);
    }

    const ordered = [...normalized].sort(
      (left, right) => left.sortOrder - right.sortOrder,
    );

    switch (calculationType) {
      case 'FLAT':
        this.assertSingleFlatRule(ordered);
        return ordered;
      case 'PER_WEIGHT':
        this.assertSingleUnitRule(ordered, 'PER_WEIGHT');
        return ordered;
      case 'PER_PIECE':
        this.assertSingleUnitRule(ordered, 'PER_PIECE');
        return ordered;
      case 'TIERED_WEIGHT':
        this.assertTieredWeightRules(ordered);
        return ordered;
    }
  }

  private assertExistingRulesCompatible(rateCard: RateCardRecord): void {
    this.normalizeRules(
      rateCard.calculationType,
      rateCard.rules.map((rule) => ({
        sortOrder: rule.sortOrder,
        minWeight: rule.minWeight === null ? null : Number(rule.minWeight),
        maxWeight: rule.maxWeight === null ? null : Number(rule.maxWeight),
        flatAmountMinor:
          rule.flatAmountMinor === null
            ? null
            : Number(rule.flatAmountMinor.toString()),
        unitAmountMinor:
          rule.unitAmountMinor === null
            ? null
            : Number(rule.unitAmountMinor.toString()),
      })),
    );
  }

  private assertSingleFlatRule(rules: ReplaceRateRuleRecord[]): void {
    if (rules.length !== 1) {
      throw new InvalidRatesInputError(
        'Invalid rates input: FLAT calculation requires exactly one rule',
      );
    }

    const [rule] = rules;

    if (
      !rule ||
      rule.flatAmountMinor === null ||
      rule.unitAmountMinor !== null ||
      rule.minWeight !== null ||
      rule.maxWeight !== null
    ) {
      throw new InvalidRatesInputError(
        'Invalid rates input: FLAT rules require only flatAmountMinor',
      );
    }
  }

  private assertSingleUnitRule(
    rules: ReplaceRateRuleRecord[],
    calculationType: 'PER_WEIGHT' | 'PER_PIECE',
  ): void {
    if (rules.length !== 1) {
      throw new InvalidRatesInputError(
        `Invalid rates input: ${calculationType} requires exactly one rule`,
      );
    }

    const [rule] = rules;

    if (
      !rule ||
      rule.unitAmountMinor === null ||
      rule.flatAmountMinor !== null ||
      rule.minWeight !== null ||
      rule.maxWeight !== null
    ) {
      throw new InvalidRatesInputError(
        `Invalid rates input: ${calculationType} rules require only unitAmountMinor`,
      );
    }
  }

  private assertTieredWeightRules(rules: ReplaceRateRuleRecord[]): void {
    let lastMaxScaled: bigint | null = null;

    for (let index = 0; index < rules.length; index += 1) {
      const rule = rules[index];

      if (!rule) {
        continue;
      }

      if (
        rule.flatAmountMinor === null ||
        rule.unitAmountMinor !== null ||
        rule.minWeight === null
      ) {
        throw new InvalidRatesInputError(
          'Invalid rates input: TIERED_WEIGHT rules require minWeight and flatAmountMinor',
        );
      }

      const minScaled = this.scaledFromText(rule.minWeight, 3);
      const maxScaled =
        rule.maxWeight === null ? null : this.scaledFromText(rule.maxWeight, 3);

      if (maxScaled !== null && maxScaled <= minScaled) {
        throw new InvalidRatesInputError(
          'Invalid rates input: maxWeight must be greater than minWeight',
        );
      }

      if (lastMaxScaled !== null && minScaled < lastMaxScaled) {
        throw new InvalidRatesInputError(
          'Invalid rates input: tiered weight rules cannot overlap',
        );
      }

      if (maxScaled === null && index !== rules.length - 1) {
        throw new InvalidRatesInputError(
          'Invalid rates input: only the last tier can be open-ended',
        );
      }

      lastMaxScaled = maxScaled;
    }
  }

  private selectRule(rateCard: RateCardRecord, weightThousandths: bigint) {
    switch (rateCard.calculationType) {
      case 'FLAT':
      case 'PER_WEIGHT':
      case 'PER_PIECE': {
        const [rule] = rateCard.rules;

        if (!rule) {
          throw new RateQuoteConflictError('Rate card has no applicable rule');
        }

        return rule;
      }
      case 'TIERED_WEIGHT': {
        const matched = rateCard.rules.find((rule) => {
          if (!rule.minWeight) {
            return false;
          }

          const min = this.scaledFromText(rule.minWeight, 3);
          const max =
            rule.maxWeight === null
              ? null
              : this.scaledFromText(rule.maxWeight, 3);

          return (
            weightThousandths >= min &&
            (max === null || weightThousandths < max)
          );
        });

        if (!matched) {
          throw new RateQuoteConflictError(
            'No tiered weight rule matches the requested weight',
          );
        }

        return matched;
      }
    }
  }

  private calculateCourierAmount(
    calculationType: RateCalculationType,
    rule: RateCardRecord['rules'][number],
    weightThousandths: bigint,
    pieceCount: number,
  ): bigint {
    switch (calculationType) {
      case 'FLAT':
      case 'TIERED_WEIGHT':
        if (rule.flatAmountMinor === null) {
          throw new RateQuoteConflictError(
            'Rate rule is missing flatAmountMinor',
          );
        }

        return rule.flatAmountMinor;
      case 'PER_WEIGHT':
        if (rule.unitAmountMinor === null) {
          throw new RateQuoteConflictError(
            'Rate rule is missing unitAmountMinor',
          );
        }

        return (rule.unitAmountMinor * weightThousandths + 500n) / 1000n;
      case 'PER_PIECE':
        if (rule.unitAmountMinor === null) {
          throw new RateQuoteConflictError(
            'Rate rule is missing unitAmountMinor',
          );
        }

        return rule.unitAmountMinor * BigInt(pieceCount);
    }
  }

  private async loadService(
    organizationId: string,
    serviceId: string,
  ): Promise<CourierServiceRecord> {
    const service = await this.ratesRepository.findServiceById(
      organizationId,
      serviceId,
    );

    if (!service) {
      throw new CourierServiceNotFoundError(serviceId);
    }

    return service;
  }

  private ensureServiceAvailable(service: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  }): void {
    if (!service.isActive) {
      throw new CourierServiceUnavailableError(
        `Courier service is inactive: ${service.id}`,
      );
    }
  }

  private page(value?: number): number {
    const page = value ?? DEFAULT_PAGE;

    if (!Number.isInteger(page) || page < 1) {
      throw new InvalidRatesInputError(
        'Invalid rates input: page must be a positive integer',
      );
    }

    return page;
  }

  private pageSize(value?: number): number {
    const pageSize = value ?? DEFAULT_PAGE_SIZE;

    if (
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > MAX_PAGE_SIZE
    ) {
      throw new InvalidRatesInputError(
        'Invalid rates input: pageSize is out of range',
      );
    }

    return pageSize;
  }

  private code(value: string, field: string): string {
    const normalized = this.requiredText(value, field).toUpperCase();

    if (!CODE_PATTERN.test(normalized)) {
      throw new InvalidRatesInputError(
        `Invalid rates input: ${field} format is invalid`,
      );
    }

    return normalized;
  }

  private name(value: string, field: string): string {
    const normalized = this.requiredText(value, field);

    if (normalized.length < 2 || normalized.length > 120) {
      throw new InvalidRatesInputError(
        `Invalid rates input: ${field} is invalid`,
      );
    }

    return normalized;
  }

  private optionalText(value?: string | null): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private optionalLongText(value?: string | null): string | null {
    const normalized = this.optionalText(value);

    if (normalized !== null && normalized.length > 500) {
      throw new InvalidRatesInputError(
        'Invalid rates input: description is too long',
      );
    }

    return normalized;
  }

  private requiredText(
    value: string | null | undefined,
    field: string,
  ): string {
    const normalized = typeof value === 'string' ? value.trim() : '';

    if (!normalized) {
      throw new InvalidRatesInputError(
        `Invalid rates input: ${field} is required`,
      );
    }

    return normalized;
  }

  private optionalUuid(
    value: string | null | undefined,
    field: string,
  ): string | undefined {
    const normalized = this.optionalText(value);
    return normalized === null
      ? undefined
      : this.requiredText(normalized, field);
  }

  private rateCalculationType(
    value: string,
    field: string,
  ): RateCalculationType {
    if (!(RATE_CALCULATION_TYPE_VALUES as readonly string[]).includes(value)) {
      throw new InvalidRatesInputError(
        `Invalid rates input: ${field} is invalid`,
      );
    }

    return value as RateCalculationType;
  }

  private rateCardStatus(value: string, field: string) {
    if (!(RATE_CARD_STATUS_VALUES as readonly string[]).includes(value)) {
      throw new InvalidRatesInputError(
        `Invalid rates input: ${field} is invalid`,
      );
    }

    return value as RateCardRecord['status'];
  }

  private weight(value: number, field: string): bigint {
    return this.scaledIntegerFromNumber(value, 3, field, {
      minExclusive: 0,
      maxInclusive: 1_000_000,
    });
  }

  private pieceCount(value?: number): number {
    const pieceCount = value ?? 1;

    if (
      !Number.isInteger(pieceCount) ||
      pieceCount < 1 ||
      pieceCount > 10_000
    ) {
      throw new InvalidRatesInputError(
        'Invalid rates input: pieceCount is invalid',
      );
    }

    return pieceCount;
  }

  private positiveInt(value: number, field: string): number {
    if (!Number.isInteger(value) || value < 1) {
      throw new InvalidRatesInputError(
        `Invalid rates input: ${field} must be a positive integer`,
      );
    }

    return value;
  }

  private moneyMinor(
    value: number,
    field: string,
    options: { allowZero?: boolean } = {},
  ): bigint {
    if (!Number.isInteger(value)) {
      throw new InvalidRatesInputError(
        `Invalid rates input: ${field} must be an integer`,
      );
    }

    if (options.allowZero ? value < 0 : value <= 0) {
      throw new InvalidRatesInputError(
        `Invalid rates input: ${field} is invalid`,
      );
    }

    return BigInt(value);
  }

  private decimalText(
    value: number,
    scale: number,
    field: string,
    options: {
      minInclusive?: number;
      minExclusive?: number;
      maxInclusive?: number;
    } = {},
  ): string {
    const scaled = this.scaledIntegerFromNumber(value, scale, field, options);
    return this.formatScaled(scaled, scale);
  }

  private scaledIntegerFromNumber(
    value: number,
    scale: number,
    field: string,
    options: {
      minInclusive?: number;
      minExclusive?: number;
      maxInclusive?: number;
    } = {},
  ): bigint {
    if (!Number.isFinite(value)) {
      throw new InvalidRatesInputError(
        `Invalid rates input: ${field} is invalid`,
      );
    }

    const scaledNumber = Number(value.toFixed(scale));

    if (
      options.minInclusive !== undefined &&
      scaledNumber < options.minInclusive
    ) {
      throw new InvalidRatesInputError(
        `Invalid rates input: ${field} is invalid`,
      );
    }

    if (
      options.minExclusive !== undefined &&
      scaledNumber <= options.minExclusive
    ) {
      throw new InvalidRatesInputError(
        `Invalid rates input: ${field} is invalid`,
      );
    }

    if (
      options.maxInclusive !== undefined &&
      scaledNumber > options.maxInclusive
    ) {
      throw new InvalidRatesInputError(
        `Invalid rates input: ${field} is invalid`,
      );
    }

    const normalized = scaledNumber.toFixed(scale);
    return this.scaledFromText(normalized, scale);
  }

  private scaledFromText(value: string, scale: number): bigint {
    const [wholePart, fractionPart = ''] = value.split('.');
    const sign = wholePart.startsWith('-') ? -1n : 1n;
    const digits = wholePart.replace('-', '');
    const paddedFraction = `${fractionPart}${'0'.repeat(scale)}`.slice(
      0,
      scale,
    );
    const whole = BigInt(digits || '0');
    const fraction = BigInt(paddedFraction || '0');
    const factor = 10n ** BigInt(scale);

    return sign * (whole * factor + fraction);
  }

  private formatScaled(value: bigint, scale: number): string {
    const sign = value < 0 ? '-' : '';
    const normalized = value < 0 ? value * -1n : value;
    const factor = 10n ** BigInt(scale);
    const whole = normalized / factor;
    const fraction = normalized % factor;

    return `${sign}${whole}.${fraction.toString().padStart(scale, '0')}`;
  }

  private commandContext(
    context: CommandContext | undefined,
    organizationId: string,
  ): CommandContext | undefined {
    if (!context) {
      return undefined;
    }

    this.requiredText(context.actorEmployeeId, 'actorEmployeeId');

    if (context.organizationId !== organizationId) {
      throw new InvalidRatesInputError(
        'Invalid rates input: command context organization mismatch',
      );
    }

    return context;
  }

  private requiredCommandContext(
    context: CommandContext | undefined,
    organizationId: string,
  ): CommandContext {
    const commandContext = this.commandContext(context, organizationId);

    if (!commandContext) {
      throw new InvalidRatesInputError(
        'Invalid rates input: command context is required',
      );
    }

    return commandContext;
  }
}
