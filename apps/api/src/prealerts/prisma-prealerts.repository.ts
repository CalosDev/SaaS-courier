import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type Employee,
  type Prealert,
} from '../generated/prisma/client';

import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';
import { PrealertCodeService } from './prealert-code.service';
import {
  InvalidPrealertStateTransitionError,
  PrealertCodeGenerationError,
  PrealertTrackingConflictError,
} from './prealert.errors';
import { PrealertsRepository } from './prealerts.repository';
import type {
  CreatePrealertRecord,
  ListPrealertsRecord,
  PrealertEmployeeSummary,
  PrealertListResult,
  PrealertRecord,
  UpdatePrealertRecord,
} from './prealert.types';

const PREALERT_CODE_GENERATION_ATTEMPTS = 10;

type PrealertWithRelations = Prealert & {
  customer: {
    id: string;
    customerCode: string;
    type: 'INDIVIDUAL' | 'BUSINESS';
    firstName: string | null;
    lastName: string | null;
    businessName: string | null;
  };
  createdByEmployee: Pick<Employee, 'id' | 'firstName' | 'lastName'>;
  cancelledByEmployee: Pick<Employee, 'id' | 'firstName' | 'lastName'> | null;
};

@Injectable()
export class PrismaPrealertsRepository implements PrealertsRepository {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly prealertCodeService: PrealertCodeService,
  ) {}

  async create(
    input: CreatePrealertRecord,
    context?: CommandContext,
  ): Promise<PrealertRecord> {
    try {
      const createdPrealertId = await this.prismaService.$transaction(
        async (tx) => {
          for (
            let attempt = 0;
            attempt < PREALERT_CODE_GENERATION_ATTEMPTS;
            attempt += 1
          ) {
            const prealertCode = this.prealertCodeService.generate();

            try {
              const created = await tx.prealert.create({
                data: {
                  organizationId: input.organizationId,
                  customerId: input.customerId,
                  createdByEmployeeId: input.createdByEmployeeId,
                  prealertCode,
                  externalTrackingNumber: input.externalTrackingNumber,
                  externalTrackingNumberNormalized:
                    input.externalTrackingNumberNormalized,
                  carrierName: input.carrierName,
                  storeName: input.storeName,
                  purchaseDate: input.purchaseDate,
                  description: input.description,
                  quantity: input.quantity,
                  declaredValue: new Prisma.Decimal(input.declaredValue),
                  currencyCode: input.currencyCode,
                  invoiceStatus: input.invoiceStatus,
                  status: input.status,
                  notes: input.notes,
                },
              });

              if (context) {
                const snapshot = this.auditSnapshotFromRow(created);

                await this.auditWriter.write(tx, {
                  context,
                  action: 'prealert.created',
                  entityType: 'PREALERT',
                  entityId: created.id,
                  changedFields: Object.keys(snapshot),
                  afterData: snapshot,
                  payload: snapshot,
                });
              }

              return created.id;
            } catch (error) {
              if (this.isPrealertCodeConflictError(error)) {
                continue;
              }

              if (this.isTrackingConflictError(error)) {
                throw new PrealertTrackingConflictError();
              }

              throw error;
            }
          }

          throw new PrealertCodeGenerationError();
        },
      );

      const createdPrealert = await this.findById(
        input.organizationId,
        createdPrealertId,
      );

      if (!createdPrealert) {
        throw new Error('Created prealert could not be reloaded');
      }

      return createdPrealert;
    } catch (error) {
      if (
        error instanceof PrealertTrackingConflictError ||
        error instanceof PrealertCodeGenerationError
      ) {
        throw error;
      }

      if (this.isTrackingConflictError(error)) {
        throw new PrealertTrackingConflictError();
      }

      throw error;
    }
  }

  async findById(
    organizationId: string,
    prealertId: string,
  ): Promise<PrealertRecord | null> {
    const prealert = await this.prismaService.prealert.findFirst({
      where: {
        organizationId,
        id: prealertId,
        deletedAt: null,
      },
      include: this.prealertInclude(),
    });

    return prealert ? this.toRecord(prealert) : null;
  }

  async list(input: ListPrealertsRecord): Promise<PrealertListResult> {
    const where: Prisma.PrealertWhereInput = {
      organizationId: input.organizationId,
      deletedAt: null,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.invoiceStatus !== undefined
        ? { invoiceStatus: input.invoiceStatus }
        : {}),
      ...(input.customerId !== undefined
        ? { customerId: input.customerId }
        : {}),
      ...(input.createdFrom || input.createdTo
        ? {
            createdAt: {
              ...(input.createdFrom ? { gte: input.createdFrom } : {}),
              ...(input.createdTo ? { lte: input.createdTo } : {}),
            },
          }
        : {}),
      ...(input.q
        ? {
            OR: [
              {
                prealertCode: {
                  contains: input.q,
                  mode: 'insensitive',
                },
              },
              {
                externalTrackingNumber: {
                  contains: input.q,
                  mode: 'insensitive',
                },
              },
              {
                externalTrackingNumberNormalized: {
                  contains: input.q.toUpperCase(),
                },
              },
              {
                carrierName: {
                  contains: input.q,
                  mode: 'insensitive',
                },
              },
              {
                storeName: {
                  contains: input.q,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: input.q,
                  mode: 'insensitive',
                },
              },
              {
                customer: {
                  customerCode: {
                    contains: input.q,
                    mode: 'insensitive',
                  },
                },
              },
              {
                customer: {
                  firstName: {
                    contains: input.q,
                    mode: 'insensitive',
                  },
                },
              },
              {
                customer: {
                  lastName: {
                    contains: input.q,
                    mode: 'insensitive',
                  },
                },
              },
              {
                customer: {
                  businessName: {
                    contains: input.q,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    };
    const skip = (input.page - 1) * input.pageSize;
    const [totalItems, prealerts] = await this.prismaService.$transaction(
      async (tx) => {
        const totalCount = await tx.prealert.count({ where });
        const rows = await tx.prealert.findMany({
          where,
          include: this.prealertInclude(),
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip,
          take: input.pageSize,
        });

        return [totalCount, rows] as const;
      },
    );

    return {
      items: prealerts.map((prealert) => this.toRecord(prealert)),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems,
        totalPages:
          totalItems === 0 ? 0 : Math.ceil(totalItems / input.pageSize),
      },
    };
  }

  async update(
    input: UpdatePrealertRecord,
    context?: CommandContext,
  ): Promise<PrealertRecord | null> {
    try {
      const updatedPrealertId = await this.prismaService.$transaction(
        async (tx) => {
          const current = await tx.prealert.findFirst({
            where: {
              organizationId: input.organizationId,
              id: input.prealertId,
              deletedAt: null,
            },
          });

          if (!current) {
            return null;
          }

          if (current.status !== 'PENDING_ARRIVAL') {
            throw new InvalidPrealertStateTransitionError(
              'Only pending prealerts can be updated',
            );
          }

          const changedFields = this.collectChangedFields(input);
          const updated = await tx.prealert.update({
            where: { id: current.id },
            data: {
              ...(input.customerId !== undefined
                ? { customerId: input.customerId }
                : {}),
              ...(input.externalTrackingNumber !== undefined
                ? { externalTrackingNumber: input.externalTrackingNumber }
                : {}),
              ...(input.externalTrackingNumberNormalized !== undefined
                ? {
                    externalTrackingNumberNormalized:
                      input.externalTrackingNumberNormalized,
                  }
                : {}),
              ...(input.carrierName !== undefined
                ? { carrierName: input.carrierName }
                : {}),
              ...(input.storeName !== undefined
                ? { storeName: input.storeName }
                : {}),
              ...(input.purchaseDate !== undefined
                ? { purchaseDate: input.purchaseDate }
                : {}),
              ...(input.description !== undefined
                ? { description: input.description }
                : {}),
              ...(input.quantity !== undefined
                ? { quantity: input.quantity }
                : {}),
              ...(input.declaredValue !== undefined
                ? { declaredValue: new Prisma.Decimal(input.declaredValue) }
                : {}),
              ...(input.currencyCode !== undefined
                ? { currencyCode: input.currencyCode }
                : {}),
              ...(input.invoiceStatus !== undefined
                ? { invoiceStatus: input.invoiceStatus }
                : {}),
              ...(input.notes !== undefined ? { notes: input.notes } : {}),
            },
          });

          if (context && changedFields.length > 0) {
            await this.auditWriter.write(tx, {
              context,
              action: 'prealert.updated',
              entityType: 'PREALERT',
              entityId: updated.id,
              changedFields,
              beforeData: this.auditSnapshotFromRow(current),
              afterData: this.auditSnapshotFromRow(updated),
              payload: {
                ...this.auditSnapshotFromRow(updated),
                changedFields,
              },
            });
          }

          return updated.id;
        },
      );

      if (!updatedPrealertId) {
        return null;
      }

      return this.findById(input.organizationId, updatedPrealertId);
    } catch (error) {
      if (error instanceof InvalidPrealertStateTransitionError) {
        throw error;
      }

      if (this.isTrackingConflictError(error)) {
        throw new PrealertTrackingConflictError();
      }

      throw error;
    }
  }

  async cancel(
    organizationId: string,
    prealertId: string,
    reason: string,
    context?: CommandContext,
  ): Promise<PrealertRecord | null> {
    const cancelledPrealertId = await this.prismaService.$transaction(
      async (tx) => {
        const current = await tx.prealert.findFirst({
          where: {
            organizationId,
            id: prealertId,
            deletedAt: null,
          },
        });

        if (!current) {
          return null;
        }

        if (current.status === 'CANCELLED') {
          return current.id;
        }

        if (current.status !== 'PENDING_ARRIVAL') {
          throw new InvalidPrealertStateTransitionError(
            'Only pending prealerts can be cancelled',
          );
        }

        if (!context?.actorEmployeeId) {
          throw new InvalidPrealertStateTransitionError(
            'Cancellation context requires an employee actor',
          );
        }

        const updated = await tx.prealert.update({
          where: { id: current.id },
          data: {
            status: 'CANCELLED',
            cancellationReason: reason,
            cancelledAt: new Date(),
            cancelledByEmployeeId: context.actorEmployeeId,
          },
        });

        if (context) {
          await this.auditWriter.write(tx, {
            context,
            action: 'prealert.cancelled',
            entityType: 'PREALERT',
            entityId: updated.id,
            changedFields: ['status', 'cancellationReason', 'cancelledAt'],
            beforeData: this.auditSnapshotFromRow(current),
            afterData: this.auditSnapshotFromRow(updated),
            reason,
            payload: this.auditSnapshotFromRow(updated),
          });
        }

        return updated.id;
      },
    );

    if (!cancelledPrealertId) {
      return null;
    }

    return this.findById(organizationId, cancelledPrealertId);
  }

  private prealertInclude() {
    return {
      customer: {
        select: {
          id: true,
          customerCode: true,
          type: true,
          firstName: true,
          lastName: true,
          businessName: true,
        },
      },
      createdByEmployee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      cancelledByEmployee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    } satisfies Prisma.PrealertInclude;
  }

  private toRecord(prealert: PrealertWithRelations): PrealertRecord {
    return {
      id: prealert.id,
      prealertCode: prealert.prealertCode,
      customerId: prealert.customerId,
      externalTrackingNumber: prealert.externalTrackingNumber,
      carrierName: prealert.carrierName,
      storeName: prealert.storeName,
      purchaseDate: prealert.purchaseDate,
      description: prealert.description,
      quantity: prealert.quantity,
      declaredValue: prealert.declaredValue.toFixed(2),
      currencyCode: prealert.currencyCode,
      invoiceStatus: prealert.invoiceStatus,
      status: prealert.status,
      notes: prealert.notes,
      cancellationReason: prealert.cancellationReason,
      cancelledAt: prealert.cancelledAt,
      customer: {
        id: prealert.customer.id,
        customerCode: prealert.customer.customerCode,
        type: prealert.customer.type,
        displayName: this.customerDisplayName(prealert.customer),
      },
      createdBy: this.employeeSummary(prealert.createdByEmployee),
      cancelledBy: prealert.cancelledByEmployee
        ? this.employeeSummary(prealert.cancelledByEmployee)
        : null,
      createdAt: prealert.createdAt,
      updatedAt: prealert.updatedAt,
    };
  }

  private customerDisplayName(
    customer: PrealertWithRelations['customer'],
  ): string {
    if (customer.businessName) {
      return customer.businessName;
    }

    const fullName = [customer.firstName, customer.lastName]
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      )
      .join(' ')
      .trim();

    return fullName || customer.customerCode;
  }

  private employeeSummary(
    employee: Pick<Employee, 'id' | 'firstName' | 'lastName'>,
  ): PrealertEmployeeSummary {
    return {
      id: employee.id,
      displayName: [employee.firstName, employee.lastName]
        .filter((value) => value.trim().length > 0)
        .join(' ')
        .trim(),
    };
  }

  private auditSnapshot(prealert: PrealertRecord): Record<string, unknown> {
    return {
      prealertCode: prealert.prealertCode,
      customerId: prealert.customer.id,
      externalTrackingNumberMasked: this.maskTracking(
        prealert.externalTrackingNumber,
      ),
      carrierName: prealert.carrierName,
      storeName: prealert.storeName,
      quantity: prealert.quantity,
      declaredValue: prealert.declaredValue,
      currencyCode: prealert.currencyCode,
      invoiceStatus: prealert.invoiceStatus,
      status: prealert.status,
    };
  }

  private auditSnapshotFromRow(
    prealert: Pick<
      Prealert,
      | 'prealertCode'
      | 'customerId'
      | 'externalTrackingNumber'
      | 'carrierName'
      | 'storeName'
      | 'quantity'
      | 'declaredValue'
      | 'currencyCode'
      | 'invoiceStatus'
      | 'status'
    >,
  ): Record<string, unknown> {
    return {
      prealertCode: prealert.prealertCode,
      customerId: prealert.customerId,
      externalTrackingNumberMasked: this.maskTracking(
        prealert.externalTrackingNumber,
      ),
      carrierName: prealert.carrierName,
      storeName: prealert.storeName,
      quantity: prealert.quantity,
      declaredValue: prealert.declaredValue.toFixed(2),
      currencyCode: prealert.currencyCode,
      invoiceStatus: prealert.invoiceStatus,
      status: prealert.status,
    };
  }

  private maskTracking(value: string): string {
    const trimmed = value.trim();

    if (trimmed.length <= 8) {
      return `${trimmed.slice(0, 2)}****${trimmed.slice(-2)}`;
    }

    return `${trimmed.slice(0, 4)}${'*'.repeat(Math.max(trimmed.length - 8, 4))}${trimmed.slice(-4)}`;
  }

  private collectChangedFields(input: UpdatePrealertRecord): string[] {
    const changedFields: string[] = [];

    if (input.customerId !== undefined) changedFields.push('customerId');
    if (input.externalTrackingNumber !== undefined) {
      changedFields.push('externalTrackingNumber');
    }
    if (input.carrierName !== undefined) changedFields.push('carrierName');
    if (input.storeName !== undefined) changedFields.push('storeName');
    if (input.purchaseDate !== undefined) changedFields.push('purchaseDate');
    if (input.description !== undefined) changedFields.push('description');
    if (input.quantity !== undefined) changedFields.push('quantity');
    if (input.declaredValue !== undefined) changedFields.push('declaredValue');
    if (input.currencyCode !== undefined) changedFields.push('currencyCode');
    if (input.invoiceStatus !== undefined) changedFields.push('invoiceStatus');
    if (input.notes !== undefined) changedFields.push('notes');

    return changedFields;
  }

  private isPrealertCodeConflictError(error: unknown): boolean {
    return this.hasKnownTarget(
      error,
      'prealerts_organization_id_prealert_code_key',
      'prealertCode',
      'prealert_code',
      'organizationId',
    );
  }

  private isTrackingConflictError(error: unknown): boolean {
    return this.hasKnownTarget(
      error,
      'prealerts_one_pending_tracking_per_organization',
      'externalTrackingNumberNormalized',
      'external_tracking_number_normalized',
      'organizationId',
    );
  }

  private hasKnownTarget(
    error: unknown,
    targetName: string,
    ...candidateFragments: string[]
  ): boolean {
    if (!this.isKnownRequestError(error) || error.code !== 'P2002') {
      return false;
    }

    const target = error.meta?.target;
    const targetText = Array.isArray(target)
      ? target.join(',')
      : typeof target === 'string'
        ? target
        : '';
    const driverAdapterCause = this.readDriverAdapterCause(error.meta);
    const constraintFields = Array.isArray(
      driverAdapterCause?.constraint?.fields,
    )
      ? driverAdapterCause.constraint.fields.join(',')
      : '';
    const originalMessage =
      typeof driverAdapterCause?.originalMessage === 'string'
        ? driverAdapterCause.originalMessage
        : '';
    const haystack = [targetText, constraintFields, originalMessage]
      .filter((value) => value.length > 0)
      .join(',');

    return (
      haystack.includes(targetName) ||
      candidateFragments.some((fragment) => haystack.includes(fragment))
    );
  }

  private isKnownRequestError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Error && 'code' in error && 'meta' in error;
  }

  private readDriverAdapterCause(
    meta: Prisma.PrismaClientKnownRequestError['meta'],
  ):
    | {
        constraint?: {
          fields?: unknown;
        };
        originalMessage?: unknown;
      }
    | undefined {
    if (!meta || typeof meta !== 'object' || !('driverAdapterError' in meta)) {
      return undefined;
    }

    const driverAdapterError = meta.driverAdapterError;

    if (
      !driverAdapterError ||
      typeof driverAdapterError !== 'object' ||
      !('cause' in driverAdapterError)
    ) {
      return undefined;
    }

    const cause = driverAdapterError.cause;

    return cause && typeof cause === 'object' ? cause : undefined;
  }
}
