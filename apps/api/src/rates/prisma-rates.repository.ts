import { Injectable } from '@nestjs/common';

import { changedFields } from '../audit/audit-snapshot';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import {
  Prisma,
  type CourierService,
  type RateRule,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';
import {
  CourierServiceCodeConflictError,
  RateCardConflictError,
} from './rates.errors';
import { RatesRepository } from './rates.repository';
import type {
  CourierServiceListResult,
  CourierServiceRecord,
  CreateCourierServiceRecord,
  CreateRateCardRecord,
  ListCourierServicesRecord,
  ListRateCardsRecord,
  RateCardListResult,
  RateCardRecord,
  RateCardServiceSummary,
  RateRuleRecord,
  ReplaceRateRulesRecord,
  UpdateCourierServiceRecord,
  UpdateRateCardRecord,
} from './rates.types';

type RateCardWithRelations = Prisma.RateCardGetPayload<{
  include: {
    service: {
      select: {
        id: true;
        code: true;
        name: true;
        isActive: true;
      };
    };
    rules: true;
  };
}>;

@Injectable()
export class PrismaRatesRepository implements RatesRepository {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(private readonly prismaService: PrismaService) {}

  async listServices(
    input: ListCourierServicesRecord,
  ): Promise<CourierServiceListResult> {
    const where: Prisma.CourierServiceWhereInput = {
      organizationId: input.organizationId,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.q
        ? {
            OR: [
              { code: { contains: input.q, mode: 'insensitive' } },
              { name: { contains: input.q, mode: 'insensitive' } },
              { description: { contains: input.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (input.page - 1) * input.pageSize;
    const [totalItems, items] = await this.prismaService.$transaction(
      async (tx) => {
        const total = await tx.courierService.count({ where });
        const rows = await tx.courierService.findMany({
          where,
          orderBy: [{ code: 'asc' }, { id: 'asc' }],
          skip,
          take: input.pageSize,
        });

        return [total, rows] as const;
      },
    );

    return {
      items: items.map((item) => this.toCourierServiceRecord(item)),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems,
        totalPages:
          totalItems === 0 ? 0 : Math.ceil(totalItems / input.pageSize),
      },
    };
  }

  async findServiceById(
    organizationId: string,
    serviceId: string,
  ): Promise<CourierServiceRecord | null> {
    const service = await this.prismaService.courierService.findFirst({
      where: {
        organizationId,
        id: serviceId,
      },
    });

    return service ? this.toCourierServiceRecord(service) : null;
  }

  async createService(
    input: CreateCourierServiceRecord,
    context?: CommandContext,
  ): Promise<CourierServiceRecord> {
    try {
      const created = await this.prismaService.$transaction(async (tx) => {
        const service = await tx.courierService.create({
          data: input,
        });

        if (context) {
          const snapshot = this.courierServiceSnapshot(service);
          await this.auditWriter.write(tx, {
            context,
            action: 'service.created',
            entityType: 'COURIER_SERVICE',
            entityId: service.id,
            changedFields: Object.keys(snapshot),
            afterData: snapshot,
            payload: snapshot,
            emitOutbox: false,
          });
        }

        return service;
      });

      return this.toCourierServiceRecord(created);
    } catch (error) {
      if (this.isCourierServiceCodeConflict(error)) {
        throw new CourierServiceCodeConflictError(input.code);
      }

      throw error;
    }
  }

  async updateService(
    input: UpdateCourierServiceRecord,
    context?: CommandContext,
  ): Promise<CourierServiceRecord | null> {
    try {
      const updatedId = await this.prismaService.$transaction(async (tx) => {
        const current = await tx.courierService.findFirst({
          where: {
            organizationId: input.organizationId,
            id: input.serviceId,
          },
        });

        if (!current) {
          return null;
        }

        const beforeData = this.courierServiceSnapshot(current);
        const afterData = {
          code: input.code ?? current.code,
          name: input.name ?? current.name,
          description:
            input.description !== undefined
              ? input.description
              : current.description,
          isActive: input.isActive ?? current.isActive,
        };
        const fields = changedFields(beforeData, afterData);

        if (fields.length === 0) {
          return current.id;
        }

        const updated = await tx.courierService.update({
          where: { id: current.id },
          data: {
            ...(input.code !== undefined ? { code: input.code } : {}),
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
            ...(input.isActive !== undefined
              ? { isActive: input.isActive }
              : {}),
          },
        });

        if (context) {
          await this.auditWriter.write(tx, {
            context,
            action: 'service.updated',
            entityType: 'COURIER_SERVICE',
            entityId: updated.id,
            changedFields: fields,
            beforeData,
            afterData,
            payload: {
              serviceId: updated.id,
              code: updated.code,
              changedFields: fields,
            },
            emitOutbox: false,
          });
        }

        return updated.id;
      });

      if (!updatedId) {
        return null;
      }

      return this.findServiceById(input.organizationId, updatedId);
    } catch (error) {
      if (this.isCourierServiceCodeConflict(error) && input.code) {
        throw new CourierServiceCodeConflictError(input.code);
      }

      throw error;
    }
  }

  async listRateCards(input: ListRateCardsRecord): Promise<RateCardListResult> {
    const where: Prisma.RateCardWhereInput = {
      organizationId: input.organizationId,
      ...(input.serviceId !== undefined ? { serviceId: input.serviceId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.segmentKey !== undefined
        ? { segmentKey: input.segmentKey }
        : {}),
      ...(input.q
        ? {
            OR: [
              { name: { contains: input.q, mode: 'insensitive' } },
              { segmentKey: { contains: input.q, mode: 'insensitive' } },
              { segmentName: { contains: input.q, mode: 'insensitive' } },
              { service: { code: { contains: input.q, mode: 'insensitive' } } },
              { service: { name: { contains: input.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const skip = (input.page - 1) * input.pageSize;
    const [totalItems, items] = await this.prismaService.$transaction(
      async (tx) => {
        const total = await tx.rateCard.count({ where });
        const rows = await tx.rateCard.findMany({
          where,
          include: this.rateCardInclude(),
          orderBy: [
            { service: { code: 'asc' } },
            { segmentKey: 'asc' },
            { version: 'desc' },
            { id: 'asc' },
          ],
          skip,
          take: input.pageSize,
        });

        return [total, rows] as const;
      },
    );

    return {
      items: items.map((item) => this.toRateCardRecord(item)),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems,
        totalPages:
          totalItems === 0 ? 0 : Math.ceil(totalItems / input.pageSize),
      },
    };
  }

  async findRateCardById(
    organizationId: string,
    rateCardId: string,
  ): Promise<RateCardRecord | null> {
    const rateCard = await this.prismaService.rateCard.findFirst({
      where: {
        organizationId,
        id: rateCardId,
      },
      include: this.rateCardInclude(),
    });

    return rateCard ? this.toRateCardRecord(rateCard) : null;
  }

  async createRateCard(
    input: CreateRateCardRecord,
    context?: CommandContext,
  ): Promise<RateCardRecord> {
    try {
      const created = await this.prismaService.$transaction(async (tx) => {
        const rateCard = await tx.rateCard.create({
          data: {
            organizationId: input.organizationId,
            serviceId: input.serviceId,
            name: input.name,
            segmentKey: input.segmentKey,
            segmentName: input.segmentName,
            calculationType: input.calculationType,
            version: await this.nextVersion(
              tx,
              input.organizationId,
              input.serviceId,
              input.segmentKey,
            ),
            status: 'DRAFT',
            currencyCode: input.currencyCode,
            weightUnit: input.weightUnit,
          },
          include: this.rateCardInclude(),
        });

        if (context) {
          const snapshot = this.rateCardSnapshot(rateCard);
          await this.auditWriter.write(tx, {
            context,
            action: 'rate_card.created',
            entityType: 'RATE_CARD',
            entityId: rateCard.id,
            changedFields: Object.keys(snapshot),
            afterData: snapshot,
            payload: snapshot,
            emitOutbox: false,
          });
        }

        return rateCard;
      });

      return this.toRateCardRecord(created);
    } catch (error) {
      if (this.isRateCardConflict(error)) {
        throw new RateCardConflictError(
          'Rate card segment or version conflicts with an existing draft or schedule',
        );
      }

      throw error;
    }
  }

  async updateRateCard(
    input: UpdateRateCardRecord,
    context?: CommandContext,
  ): Promise<RateCardRecord | null> {
    try {
      const rateCard = await this.prismaService.$transaction(async (tx) => {
        const current = await tx.rateCard.findFirst({
          where: {
            organizationId: input.organizationId,
            id: input.rateCardId,
          },
          include: this.rateCardInclude(),
        });

        if (!current) {
          return null;
        }

        if (current.status === 'RETIRED') {
          throw new RateCardConflictError('Retired rate cards are immutable');
        }

        const activeFieldsChanged = this.rateCardMetadataChanges(
          current,
          input,
        );

        if (current.status === 'ACTIVE' && activeFieldsChanged.length === 0) {
          return current;
        }

        let target = current;
        let createdDraft = false;

        if (current.status === 'ACTIVE') {
          const draftResult = await this.findOrCreateDraftFromActive(
            tx,
            current,
            {
              currencyCode: input.currencyCode,
              weightUnit: input.weightUnit,
            },
          );
          target = draftResult.rateCard;
          createdDraft = draftResult.created;
        }

        const beforeData = this.rateCardSnapshot(target);
        const nextData = {
          serviceId: input.serviceId ?? target.service.id,
          name: input.name ?? target.name,
          segmentKey: input.segmentKey ?? target.segmentKey,
          segmentName: input.segmentName ?? target.segmentName,
          calculationType: input.calculationType ?? target.calculationType,
          currencyCode: target.currencyCode,
          weightUnit: target.weightUnit,
          version: target.version,
          status: target.status,
          effectiveFrom: target.effectiveFrom?.toISOString() ?? null,
          effectiveTo: target.effectiveTo?.toISOString() ?? null,
          previousRateCardId: target.previousRateCardId,
          ruleCount: target.rules.length,
        };
        const fields = changedFields(beforeData, nextData);

        if (fields.length === 0) {
          return target;
        }

        const updated = await tx.rateCard.update({
          where: { id: target.id },
          data: {
            ...(input.serviceId !== undefined
              ? { serviceId: input.serviceId }
              : {}),
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.segmentKey !== undefined
              ? { segmentKey: input.segmentKey }
              : {}),
            ...(input.segmentName !== undefined
              ? { segmentName: input.segmentName }
              : {}),
            ...(input.calculationType !== undefined
              ? { calculationType: input.calculationType }
              : {}),
          },
          include: this.rateCardInclude(),
        });

        if (context && createdDraft) {
          const snapshot = this.rateCardSnapshot(updated);
          await this.auditWriter.write(tx, {
            context,
            action: 'rate_card.created',
            entityType: 'RATE_CARD',
            entityId: updated.id,
            changedFields: Object.keys(snapshot),
            afterData: snapshot,
            payload: snapshot,
            emitOutbox: false,
          });
        }

        return updated;
      });

      return rateCard ? this.toRateCardRecord(rateCard) : null;
    } catch (error) {
      if (error instanceof RateCardConflictError) {
        throw error;
      }

      if (this.isRateCardConflict(error)) {
        throw new RateCardConflictError(
          'Rate card update conflicts with an existing draft or active schedule',
        );
      }

      throw error;
    }
  }

  async replaceRateRules(
    input: ReplaceRateRulesRecord,
    context?: CommandContext,
  ): Promise<RateCardRecord | null> {
    try {
      const rateCard = await this.prismaService.$transaction(async (tx) => {
        const current = await tx.rateCard.findFirst({
          where: {
            organizationId: input.organizationId,
            id: input.rateCardId,
          },
          include: this.rateCardInclude(),
        });

        if (!current) {
          return null;
        }

        if (current.status === 'RETIRED') {
          throw new RateCardConflictError('Retired rate cards are immutable');
        }

        let target = current;
        let createdDraft = false;

        if (current.status === 'ACTIVE') {
          const rulesUnchanged = this.sameRules(current.rules, input.rules);

          if (rulesUnchanged) {
            return current;
          }

          const draftResult = await this.findOrCreateDraftFromActive(
            tx,
            current,
            {
              currencyCode: input.currencyCode,
              weightUnit: input.weightUnit,
            },
          );
          target = draftResult.rateCard;
          createdDraft = draftResult.created;
        }

        const beforeData = {
          rules: target.rules.map((rule) => this.rateRuleSnapshot(rule)),
        };
        const afterRules = input.rules.map((rule) => ({
          sortOrder: rule.sortOrder,
          minWeight: rule.minWeight,
          maxWeight: rule.maxWeight,
          flatAmountMinor: rule.flatAmountMinor?.toString() ?? null,
          unitAmountMinor: rule.unitAmountMinor?.toString() ?? null,
        }));

        if (JSON.stringify(beforeData.rules) === JSON.stringify(afterRules)) {
          return target;
        }

        await tx.rateRule.deleteMany({
          where: {
            organizationId: input.organizationId,
            rateCardId: target.id,
          },
        });

        await tx.rateRule.createMany({
          data: input.rules.map((rule) => ({
            organizationId: input.organizationId,
            rateCardId: target.id,
            sortOrder: rule.sortOrder,
            minWeight:
              rule.minWeight === null
                ? null
                : new Prisma.Decimal(rule.minWeight),
            maxWeight:
              rule.maxWeight === null
                ? null
                : new Prisma.Decimal(rule.maxWeight),
            flatAmountMinor: rule.flatAmountMinor,
            unitAmountMinor: rule.unitAmountMinor,
          })),
        });

        const updated = await tx.rateCard.findUniqueOrThrow({
          where: { id: target.id },
          include: this.rateCardInclude(),
        });

        if (context && createdDraft) {
          const snapshot = this.rateCardSnapshot(updated);
          await this.auditWriter.write(tx, {
            context,
            action: 'rate_card.created',
            entityType: 'RATE_CARD',
            entityId: updated.id,
            changedFields: Object.keys(snapshot),
            afterData: snapshot,
            payload: snapshot,
            emitOutbox: false,
          });
        }

        if (context) {
          await this.auditWriter.write(tx, {
            context,
            action: 'rate_rules.replaced',
            entityType: 'RATE_CARD',
            entityId: updated.id,
            changedFields: ['rules'],
            beforeData,
            afterData: {
              rules: updated.rules.map((rule) => this.rateRuleSnapshot(rule)),
            },
            payload: {
              rateCardId: updated.id,
              ruleCount: updated.rules.length,
            },
            emitOutbox: false,
          });
        }

        return updated;
      });

      return rateCard ? this.toRateCardRecord(rateCard) : null;
    } catch (error) {
      if (error instanceof RateCardConflictError) {
        throw error;
      }

      if (this.isRateCardConflict(error)) {
        throw new RateCardConflictError(
          'Rate rules conflict with an existing draft or active schedule',
        );
      }

      throw error;
    }
  }

  async activateRateCard(
    organizationId: string,
    rateCardId: string,
    context: CommandContext,
  ): Promise<RateCardRecord | null> {
    try {
      const activated = await this.prismaService.$transaction(async (tx) => {
        const current = await tx.rateCard.findFirst({
          where: {
            organizationId,
            id: rateCardId,
          },
          include: this.rateCardInclude(),
        });

        if (!current) {
          return null;
        }

        if (current.status === 'RETIRED') {
          throw new RateCardConflictError(
            'Retired rate cards cannot be reactivated',
          );
        }

        if (!current.service.isActive) {
          throw new RateCardConflictError(
            'Inactive courier services cannot activate rate cards',
          );
        }

        if (current.rules.length === 0) {
          throw new RateCardConflictError(
            'Rate card cannot be activated without rules',
          );
        }

        if (current.status === 'ACTIVE') {
          return current;
        }

        const occurredAt = new Date();
        const overlappingActive = await tx.rateCard.findFirst({
          where: {
            organizationId,
            serviceId: current.service.id,
            segmentKey: current.segmentKey,
            status: 'ACTIVE',
            id: { not: current.id },
          },
          select: { id: true },
        });

        if (overlappingActive) {
          await tx.rateCard.update({
            where: { id: overlappingActive.id },
            data: {
              status: 'RETIRED',
              effectiveTo: occurredAt,
            },
          });
        }

        const updated = await tx.rateCard.update({
          where: { id: current.id },
          data: {
            status: 'ACTIVE',
            effectiveFrom: occurredAt,
            effectiveTo: null,
          },
          include: this.rateCardInclude(),
        });

        const beforeData = this.rateCardSnapshot(current);
        const afterData = this.rateCardSnapshot(updated);

        await this.auditWriter.write(tx, {
          context,
          action: 'rate_card.activated',
          entityType: 'RATE_CARD',
          entityId: updated.id,
          changedFields: changedFields(beforeData, afterData),
          beforeData,
          afterData,
          payload: {
            rateCardId: updated.id,
            serviceId: updated.service.id,
            segmentKey: updated.segmentKey,
            version: updated.version,
            status: updated.status,
          },
        });

        return updated;
      });

      return activated ? this.toRateCardRecord(activated) : null;
    } catch (error) {
      if (error instanceof RateCardConflictError) {
        throw error;
      }

      if (this.isRateCardConflict(error)) {
        throw new RateCardConflictError(
          'Rate card activation conflicts with an existing active schedule',
        );
      }

      throw error;
    }
  }

  private rateCardInclude() {
    return {
      service: {
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
        },
      },
      rules: {
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      },
    } satisfies Prisma.RateCardInclude;
  }

  private toCourierServiceRecord(
    service: CourierService,
  ): CourierServiceRecord {
    return {
      id: service.id,
      organizationId: service.organizationId,
      code: service.code,
      name: service.name,
      description: service.description,
      isActive: service.isActive,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }

  private toRateCardRecord(rateCard: RateCardWithRelations): RateCardRecord {
    return {
      id: rateCard.id,
      organizationId: rateCard.organizationId,
      service: this.toRateCardServiceSummary(rateCard.service),
      previousRateCardId: rateCard.previousRateCardId,
      name: rateCard.name,
      segmentKey: rateCard.segmentKey,
      segmentName: rateCard.segmentName,
      calculationType: rateCard.calculationType,
      version: rateCard.version,
      status: rateCard.status,
      currencyCode: rateCard.currencyCode,
      weightUnit: rateCard.weightUnit,
      effectiveFrom: rateCard.effectiveFrom,
      effectiveTo: rateCard.effectiveTo,
      createdAt: rateCard.createdAt,
      updatedAt: rateCard.updatedAt,
      rules: rateCard.rules.map((rule) => this.toRateRuleRecord(rule)),
    };
  }

  private toRateCardServiceSummary(
    service: RateCardWithRelations['service'],
  ): RateCardServiceSummary {
    return {
      id: service.id,
      code: service.code,
      name: service.name,
      isActive: service.isActive,
    };
  }

  private toRateRuleRecord(rule: RateRule): RateRuleRecord {
    return {
      id: rule.id,
      sortOrder: rule.sortOrder,
      minWeight: rule.minWeight?.toFixed(3) ?? null,
      maxWeight: rule.maxWeight?.toFixed(3) ?? null,
      flatAmountMinor: rule.flatAmountMinor,
      unitAmountMinor: rule.unitAmountMinor,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }

  private courierServiceSnapshot(
    service: Pick<CourierService, 'code' | 'name' | 'description' | 'isActive'>,
  ) {
    return {
      code: service.code,
      name: service.name,
      description: service.description,
      isActive: service.isActive,
    };
  }

  private rateCardSnapshot(rateCard: RateCardWithRelations) {
    return {
      serviceId: rateCard.service.id,
      serviceCode: rateCard.service.code,
      name: rateCard.name,
      segmentKey: rateCard.segmentKey,
      segmentName: rateCard.segmentName,
      calculationType: rateCard.calculationType,
      version: rateCard.version,
      status: rateCard.status,
      currencyCode: rateCard.currencyCode,
      weightUnit: rateCard.weightUnit,
      effectiveFrom: rateCard.effectiveFrom?.toISOString() ?? null,
      effectiveTo: rateCard.effectiveTo?.toISOString() ?? null,
      previousRateCardId: rateCard.previousRateCardId,
      ruleCount: rateCard.rules.length,
    };
  }

  private rateRuleSnapshot(rule: RateRule) {
    return {
      sortOrder: rule.sortOrder,
      minWeight: rule.minWeight?.toFixed(3) ?? null,
      maxWeight: rule.maxWeight?.toFixed(3) ?? null,
      flatAmountMinor: rule.flatAmountMinor?.toString() ?? null,
      unitAmountMinor: rule.unitAmountMinor?.toString() ?? null,
    };
  }

  private rateCardMetadataChanges(
    current: RateCardWithRelations,
    input: UpdateRateCardRecord,
  ): string[] {
    const nextData = {
      serviceId: input.serviceId ?? current.service.id,
      name: input.name ?? current.name,
      segmentKey: input.segmentKey ?? current.segmentKey,
      segmentName: input.segmentName ?? current.segmentName,
      calculationType: input.calculationType ?? current.calculationType,
    };

    const currentData = {
      serviceId: current.service.id,
      name: current.name,
      segmentKey: current.segmentKey,
      segmentName: current.segmentName,
      calculationType: current.calculationType,
    };

    return changedFields(currentData, nextData);
  }

  private async nextVersion(
    tx: Prisma.TransactionClient,
    organizationId: string,
    serviceId: string,
    segmentKey: string,
  ): Promise<number> {
    const latest = await tx.rateCard.findFirst({
      where: {
        organizationId,
        serviceId,
        segmentKey,
      },
      orderBy: [{ version: 'desc' }],
      select: { version: true },
    });

    return (latest?.version ?? 0) + 1;
  }

  private async findOrCreateDraftFromActive(
    tx: Prisma.TransactionClient,
    current: RateCardWithRelations,
    input: {
      currencyCode: string;
      weightUnit: 'LB' | 'KG';
    },
  ): Promise<{ rateCard: RateCardWithRelations; created: boolean }> {
    const existingDraft = await tx.rateCard.findFirst({
      where: {
        organizationId: current.organizationId,
        serviceId: current.service.id,
        segmentKey: current.segmentKey,
        status: 'DRAFT',
      },
      include: this.rateCardInclude(),
    });

    if (existingDraft) {
      return { rateCard: existingDraft, created: false };
    }

    const created = await tx.rateCard.create({
      data: {
        organizationId: current.organizationId,
        serviceId: current.service.id,
        previousRateCardId: current.id,
        name: current.name,
        segmentKey: current.segmentKey,
        segmentName: current.segmentName,
        calculationType: current.calculationType,
        version: current.version + 1,
        status: 'DRAFT',
        currencyCode: input.currencyCode,
        weightUnit: input.weightUnit,
        rules: {
          create: current.rules.map((rule) => ({
            organizationId: current.organizationId,
            sortOrder: rule.sortOrder,
            minWeight: rule.minWeight,
            maxWeight: rule.maxWeight,
            flatAmountMinor: rule.flatAmountMinor,
            unitAmountMinor: rule.unitAmountMinor,
          })),
        },
      },
      include: this.rateCardInclude(),
    });

    return { rateCard: created, created: true };
  }

  private sameRules(
    currentRules: RateRule[],
    nextRules: ReplaceRateRulesRecord['rules'],
  ): boolean {
    if (currentRules.length !== nextRules.length) {
      return false;
    }

    const currentSnapshot = currentRules
      .map((rule) => this.rateRuleSnapshot(rule))
      .sort((left, right) => left.sortOrder - right.sortOrder);
    const nextSnapshot = nextRules
      .map((rule) => ({
        sortOrder: rule.sortOrder,
        minWeight: rule.minWeight,
        maxWeight: rule.maxWeight,
        flatAmountMinor: rule.flatAmountMinor?.toString() ?? null,
        unitAmountMinor: rule.unitAmountMinor?.toString() ?? null,
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder);

    return JSON.stringify(currentSnapshot) === JSON.stringify(nextSnapshot);
  }

  private isCourierServiceCodeConflict(error: unknown): boolean {
    return this.hasConstraintReference(
      error,
      'courier_services_organization_id_code_key',
      'organization_id',
      'code',
    );
  }

  private isRateCardConflict(error: unknown): boolean {
    return (
      this.hasConstraintReference(
        error,
        'rate_cards_one_draft_per_segment_key',
        'rate_cards_org_service_segment_version_key',
        'rate_cards_no_overlap_per_service_segment',
        'rate_cards_organization_id_service_id_fkey',
      ) ||
      this.hasConstraintReference(
        error,
        'rate_cards_organization_id_service_id_fkey',
        'rate_cards_previous_rate_card_id_fkey',
      )
    );
  }

  private hasConstraintReference(
    error: unknown,
    ...fragments: string[]
  ): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const knownError = error as Prisma.PrismaClientKnownRequestError;
    const metaText =
      'meta' in knownError && knownError.meta
        ? JSON.stringify(knownError.meta)
        : '';
    const haystack = `${error.message} ${metaText}`;

    return fragments.some((fragment) => haystack.includes(fragment));
  }
}
