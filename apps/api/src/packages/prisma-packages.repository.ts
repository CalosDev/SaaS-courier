import { Injectable } from '@nestjs/common';

import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import { PrealertNotFoundError } from '../prealerts/prealert.errors';
import {
  Prisma,
  type Employee,
  type Package,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';
import { PackageCodeService } from './package-code.service';
import {
  InvalidPackageStatusTransitionError,
  PackageCodeGenerationError,
  PackageCustomerUnavailableError,
  PackagePrealertMatchRequiredError,
  PackagePrealertUnavailableError,
  PackageTrackingConflictError,
} from './package.errors';
import { PackagesRepository } from './packages.repository';
import type {
  CreateManualPackageRecord,
  CreatePackageFromPrealertRecord,
  ListPackagesRecord,
  PackageEmployeeSummary,
  PackageListResult,
  PackageMatchedSummary,
  PackageRecord,
  PackageSource,
  UpdatePackageRecord,
} from './package.types';

const PACKAGE_CODE_GENERATION_ATTEMPTS = 10;

type PackageWithRelations = Package & {
  customer: {
    id: string;
    customerCode: string;
    type: 'INDIVIDUAL' | 'BUSINESS';
    firstName: string | null;
    lastName: string | null;
    businessName: string | null;
  };
  prealert: {
    id: string;
    prealertCode: string;
    storeName: string;
  } | null;
  registeredByEmployee: Pick<Employee, 'id' | 'firstName' | 'lastName'>;
  cancelledByEmployee: Pick<Employee, 'id' | 'firstName' | 'lastName'> | null;
};

type LockedPrealertRow = {
  id: string;
  customer_id: string;
  external_tracking_number: string;
  external_tracking_number_normalized: string;
  prealert_code: string;
  store_name: string;
  status: 'PENDING_ARRIVAL' | 'MATCHED' | 'CANCELLED';
  customer_status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
};

type LockedPackageRow = {
  id: string;
  customer_id: string;
  prealert_id: string | null;
  internal_tracking_number: string;
  external_tracking_number: string;
  external_tracking_number_normalized: string;
  status: 'RECEPTION_PENDING' | 'CANCELLED';
  notes: string | null;
  cancellation_reason: string | null;
  cancelled_at: Date | null;
  cancelled_by_employee_id: string | null;
};

type LockedPrealertStateRow = {
  id: string;
  status: 'PENDING_ARRIVAL' | 'MATCHED' | 'CANCELLED';
  prealert_code: string;
};

@Injectable()
export class PrismaPackagesRepository implements PackagesRepository {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly packageCodeService: PackageCodeService,
  ) {}

  async createManual(
    input: CreateManualPackageRecord,
    context?: CommandContext,
  ): Promise<PackageRecord> {
    try {
      const createdPackageId = await this.prismaService.$transaction(
        async (tx) => {
          const matchingPendingPrealert =
            await this.findPendingPrealertByTracking(
              tx,
              input.organizationId,
              input.externalTrackingNumberNormalized,
            );

          if (matchingPendingPrealert) {
            throw new PackagePrealertMatchRequiredError();
          }

          for (
            let attempt = 0;
            attempt < PACKAGE_CODE_GENERATION_ATTEMPTS;
            attempt += 1
          ) {
            const internalTrackingNumber = this.packageCodeService.generate();

            try {
              const created = await tx.package.create({
                data: {
                  organizationId: input.organizationId,
                  customerId: input.customerId,
                  registeredByEmployeeId: input.registeredByEmployeeId,
                  internalTrackingNumber,
                  externalTrackingNumber: input.externalTrackingNumber,
                  externalTrackingNumberNormalized:
                    input.externalTrackingNumberNormalized,
                  status: 'RECEPTION_PENDING',
                  notes: input.notes,
                },
              });

              if (context) {
                const snapshot = this.packageAuditSnapshotFromRow(created);
                await this.auditWriter.write(tx, {
                  context,
                  action: 'package.created',
                  entityType: 'PACKAGE',
                  entityId: created.id,
                  changedFields: Object.keys(snapshot),
                  afterData: snapshot,
                  payload: snapshot,
                });
              }

              return created.id;
            } catch (error) {
              if (this.isPackageCodeConflictError(error)) {
                continue;
              }

              if (this.isPackageTrackingConflictError(error)) {
                throw new PackageTrackingConflictError();
              }

              throw error;
            }
          }

          throw new PackageCodeGenerationError();
        },
      );

      const createdPackage = await this.findById(
        input.organizationId,
        createdPackageId,
      );

      if (!createdPackage) {
        throw new Error('Created package could not be reloaded');
      }

      return createdPackage;
    } catch (error) {
      if (
        error instanceof PackageCodeGenerationError ||
        error instanceof PackageTrackingConflictError ||
        error instanceof PackagePrealertMatchRequiredError
      ) {
        throw error;
      }

      if (this.isPackageTrackingConflictError(error)) {
        throw new PackageTrackingConflictError();
      }

      throw error;
    }
  }

  async createFromPrealert(
    input: CreatePackageFromPrealertRecord,
    context?: CommandContext,
  ): Promise<PackageRecord> {
    try {
      const createdPackageId = await this.prismaService.$transaction(
        async (tx) => {
          const lockedPrealert = await this.lockPrealertForMatching(
            tx,
            input.organizationId,
            input.prealertId,
          );

          if (!lockedPrealert) {
            throw new PrealertNotFoundError(input.prealertId);
          }

          if (lockedPrealert.status !== 'PENDING_ARRIVAL') {
            throw new PackagePrealertUnavailableError(
              'Prealert is not available for package matching',
            );
          }

          if (lockedPrealert.customer_status === 'SUSPENDED') {
            throw new PackageCustomerUnavailableError(
              'Package customer is suspended',
            );
          }

          if (lockedPrealert.customer_status === 'CLOSED') {
            throw new PackageCustomerUnavailableError(
              'Package customer is closed',
            );
          }

          for (
            let attempt = 0;
            attempt < PACKAGE_CODE_GENERATION_ATTEMPTS;
            attempt += 1
          ) {
            const internalTrackingNumber = this.packageCodeService.generate();

            try {
              const created = await tx.package.create({
                data: {
                  organizationId: input.organizationId,
                  customerId: lockedPrealert.customer_id,
                  prealertId: lockedPrealert.id,
                  registeredByEmployeeId: input.registeredByEmployeeId,
                  internalTrackingNumber,
                  externalTrackingNumber:
                    lockedPrealert.external_tracking_number,
                  externalTrackingNumberNormalized:
                    lockedPrealert.external_tracking_number_normalized,
                  status: 'RECEPTION_PENDING',
                  notes: input.notes,
                },
              });

              await tx.prealert.update({
                where: { id: lockedPrealert.id },
                data: {
                  status: 'MATCHED',
                },
              });

              if (context) {
                const packageSnapshot =
                  this.packageAuditSnapshotFromRow(created);
                await this.auditWriter.write(tx, {
                  context,
                  action: 'package.created',
                  entityType: 'PACKAGE',
                  entityId: created.id,
                  changedFields: Object.keys(packageSnapshot),
                  afterData: packageSnapshot,
                  payload: packageSnapshot,
                });

                const prealertSnapshot = this.prealertMatchSnapshot(
                  lockedPrealert,
                  {
                    id: created.id,
                    internalTrackingNumber: created.internalTrackingNumber,
                    status: created.status,
                  },
                );
                await this.auditWriter.write(tx, {
                  context,
                  action: 'prealert.matched',
                  entityType: 'PREALERT',
                  entityId: lockedPrealert.id,
                  changedFields: ['status'],
                  afterData: prealertSnapshot,
                  payload: prealertSnapshot,
                });
              }

              return created.id;
            } catch (error) {
              if (this.isPackageCodeConflictError(error)) {
                continue;
              }

              if (this.isPackageTrackingConflictError(error)) {
                throw new PackageTrackingConflictError();
              }

              if (this.isPackagePrealertConflictError(error)) {
                throw new PackagePrealertUnavailableError(
                  'Prealert is already linked to another active package',
                );
              }

              throw error;
            }
          }

          throw new PackageCodeGenerationError();
        },
      );

      const createdPackage = await this.findById(
        input.organizationId,
        createdPackageId,
      );

      if (!createdPackage) {
        throw new Error('Created package could not be reloaded');
      }

      return createdPackage;
    } catch (error) {
      if (
        error instanceof PackageCodeGenerationError ||
        error instanceof PackageTrackingConflictError ||
        error instanceof PackagePrealertUnavailableError ||
        error instanceof PackageCustomerUnavailableError ||
        error instanceof PrealertNotFoundError
      ) {
        throw error;
      }

      if (this.isPackageTrackingConflictError(error)) {
        throw new PackageTrackingConflictError();
      }

      if (this.isPackagePrealertConflictError(error)) {
        throw new PackagePrealertUnavailableError(
          'Prealert is already linked to another active package',
        );
      }

      throw error;
    }
  }

  async findById(
    organizationId: string,
    packageId: string,
  ): Promise<PackageRecord | null> {
    const packageRecord = await this.prismaService.package.findFirst({
      where: {
        organizationId,
        id: packageId,
        deletedAt: null,
      },
      include: this.packageInclude(),
    });

    return packageRecord ? this.toPackageRecord(packageRecord) : null;
  }

  async list(input: ListPackagesRecord): Promise<PackageListResult> {
    const where: Prisma.PackageWhereInput = {
      organizationId: input.organizationId,
      deletedAt: null,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.customerId !== undefined
        ? { customerId: input.customerId }
        : {}),
      ...(input.prealertId !== undefined
        ? { prealertId: input.prealertId }
        : {}),
      ...(input.source === 'MANUAL'
        ? { prealertId: null }
        : input.source === 'PREALERT'
          ? { NOT: { prealertId: null } }
          : {}),
      ...(input.registeredFrom || input.registeredTo
        ? {
            registeredAt: {
              ...(input.registeredFrom ? { gte: input.registeredFrom } : {}),
              ...(input.registeredTo ? { lte: input.registeredTo } : {}),
            },
          }
        : {}),
      ...(input.q
        ? {
            OR: [
              {
                internalTrackingNumber: {
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
              {
                prealert: {
                  prealertCode: {
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
    const [totalItems, packages] = await this.prismaService.$transaction(
      async (tx) => {
        const totalCount = await tx.package.count({ where });
        const rows = await tx.package.findMany({
          where,
          include: this.packageInclude(),
          orderBy: [{ registeredAt: 'desc' }, { id: 'desc' }],
          skip,
          take: input.pageSize,
        });

        return [totalCount, rows] as const;
      },
    );

    return {
      items: packages.map((packageRecord) =>
        this.toPackageRecord(packageRecord),
      ),
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
    input: UpdatePackageRecord,
    context?: CommandContext,
  ): Promise<PackageRecord | null> {
    try {
      const updatedPackageId = await this.prismaService.$transaction(
        async (tx) => {
          const current = await this.lockPackage(
            tx,
            input.organizationId,
            input.packageId,
          );

          if (!current) {
            return null;
          }

          if (current.status !== 'RECEPTION_PENDING') {
            throw new InvalidPackageStatusTransitionError(
              'Only reception-pending packages can be updated',
            );
          }

          if (
            input.externalTrackingNumberNormalized !== undefined &&
            input.externalTrackingNumberNormalized !==
              current.external_tracking_number_normalized
          ) {
            const matchingPendingPrealert =
              await this.findPendingPrealertByTracking(
                tx,
                input.organizationId,
                input.externalTrackingNumberNormalized,
              );

            if (matchingPendingPrealert) {
              throw new PackagePrealertMatchRequiredError();
            }
          }

          const changed = this.collectUpdateChangedFields(current, input);

          if (changed.length === 0) {
            return current.id;
          }

          const updated = await tx.package.update({
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
              ...(input.notes !== undefined ? { notes: input.notes } : {}),
            },
          });

          if (context) {
            const beforeSnapshot =
              this.packageAuditSnapshotFromLockedRow(current);
            const afterSnapshot = this.packageAuditSnapshotFromRow(updated);

            await this.auditWriter.write(tx, {
              context,
              action: 'package.updated',
              entityType: 'PACKAGE',
              entityId: updated.id,
              changedFields: changed,
              beforeData: beforeSnapshot,
              afterData: afterSnapshot,
              payload: {
                ...afterSnapshot,
                changedFields: changed,
              },
            });
          }

          return updated.id;
        },
      );

      if (!updatedPackageId) {
        return null;
      }

      return this.findById(input.organizationId, updatedPackageId);
    } catch (error) {
      if (
        error instanceof InvalidPackageStatusTransitionError ||
        error instanceof PackagePrealertMatchRequiredError
      ) {
        throw error;
      }

      if (this.isPackageTrackingConflictError(error)) {
        throw new PackageTrackingConflictError();
      }

      throw error;
    }
  }

  async cancel(
    organizationId: string,
    packageId: string,
    reason: string,
    context?: CommandContext,
  ): Promise<PackageRecord | null> {
    const cancelledPackageId = await this.prismaService.$transaction(
      async (tx) => {
        const current = await this.lockPackage(tx, organizationId, packageId);

        if (!current) {
          return null;
        }

        if (current.status === 'CANCELLED') {
          return current.id;
        }

        if (current.status !== 'RECEPTION_PENDING') {
          throw new InvalidPackageStatusTransitionError(
            'Only reception-pending packages can be cancelled',
          );
        }

        if (!context?.actorEmployeeId) {
          throw new InvalidPackageStatusTransitionError(
            'Cancellation context requires an employee actor',
          );
        }

        const updated = await tx.package.update({
          where: { id: current.id },
          data: {
            status: 'CANCELLED',
            cancellationReason: reason,
            cancelledAt: new Date(),
            cancelledByEmployeeId: context.actorEmployeeId,
          },
        });

        if (current.prealert_id) {
          const linkedPrealert = await this.lockPrealertState(
            tx,
            organizationId,
            current.prealert_id,
          );

          if (!linkedPrealert || linkedPrealert.status !== 'MATCHED') {
            throw new PackagePrealertUnavailableError(
              'Linked prealert is not available for reopening',
            );
          }

          await tx.prealert.update({
            where: { id: linkedPrealert.id },
            data: {
              status: 'PENDING_ARRIVAL',
            },
          });

          if (context) {
            const reopenedSnapshot = {
              prealertCode: linkedPrealert.prealert_code,
              matchedPackageId: updated.id,
              status: 'PENDING_ARRIVAL',
            };
            await this.auditWriter.write(tx, {
              context,
              action: 'prealert.reopened',
              entityType: 'PREALERT',
              entityId: linkedPrealert.id,
              changedFields: ['status'],
              afterData: reopenedSnapshot,
              payload: reopenedSnapshot,
            });
          }
        }

        if (context) {
          const beforeSnapshot =
            this.packageAuditSnapshotFromLockedRow(current);
          const afterSnapshot = this.packageAuditSnapshotFromRow(updated);
          await this.auditWriter.write(tx, {
            context,
            action: 'package.cancelled',
            entityType: 'PACKAGE',
            entityId: updated.id,
            changedFields: ['status', 'cancellationReason', 'cancelledAt'],
            beforeData: beforeSnapshot,
            afterData: afterSnapshot,
            reason,
            payload: afterSnapshot,
          });
        }

        return updated.id;
      },
    );

    if (!cancelledPackageId) {
      return null;
    }

    return this.findById(organizationId, cancelledPackageId);
  }

  private packageInclude() {
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
      prealert: {
        select: {
          id: true,
          prealertCode: true,
          storeName: true,
        },
      },
      registeredByEmployee: {
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
    } satisfies Prisma.PackageInclude;
  }

  private toPackageRecord(packageRecord: PackageWithRelations): PackageRecord {
    return {
      id: packageRecord.id,
      internalTrackingNumber: packageRecord.internalTrackingNumber,
      externalTrackingNumber: packageRecord.externalTrackingNumber,
      status: packageRecord.status,
      source: this.packageSource(packageRecord.prealertId),
      notes: packageRecord.notes,
      cancellationReason: packageRecord.cancellationReason,
      cancelledAt: packageRecord.cancelledAt,
      customer: {
        id: packageRecord.customer.id,
        customerCode: packageRecord.customer.customerCode,
        type: packageRecord.customer.type,
        displayName: this.customerDisplayName(packageRecord.customer),
      },
      prealert: packageRecord.prealert
        ? {
            id: packageRecord.prealert.id,
            prealertCode: packageRecord.prealert.prealertCode,
            storeName: packageRecord.prealert.storeName,
          }
        : null,
      registeredBy: this.employeeSummary(packageRecord.registeredByEmployee),
      cancelledBy: packageRecord.cancelledByEmployee
        ? this.employeeSummary(packageRecord.cancelledByEmployee)
        : null,
      registeredAt: packageRecord.registeredAt,
      createdAt: packageRecord.createdAt,
      updatedAt: packageRecord.updatedAt,
    };
  }

  private customerDisplayName(
    customer: PackageWithRelations['customer'],
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
  ): PackageEmployeeSummary {
    return {
      id: employee.id,
      displayName: [employee.firstName, employee.lastName]
        .filter((value) => value.trim().length > 0)
        .join(' ')
        .trim(),
    };
  }

  private packageSource(prealertId: string | null): PackageSource {
    return prealertId ? 'PREALERT' : 'MANUAL';
  }

  private packageAuditSnapshotFromRow(
    packageRecord: Pick<
      Package,
      | 'customerId'
      | 'prealertId'
      | 'internalTrackingNumber'
      | 'externalTrackingNumber'
      | 'status'
    >,
  ): Record<string, unknown> {
    return {
      internalTrackingNumber: packageRecord.internalTrackingNumber,
      externalTrackingNumberMasked: this.maskTracking(
        packageRecord.externalTrackingNumber,
      ),
      customerId: packageRecord.customerId,
      prealertId: packageRecord.prealertId,
      status: packageRecord.status,
      source: this.packageSource(packageRecord.prealertId),
    };
  }

  private packageAuditSnapshotFromLockedRow(
    packageRecord: LockedPackageRow,
  ): Record<string, unknown> {
    return {
      internalTrackingNumber: packageRecord.internal_tracking_number,
      externalTrackingNumberMasked: this.maskTracking(
        packageRecord.external_tracking_number,
      ),
      customerId: packageRecord.customer_id,
      prealertId: packageRecord.prealert_id,
      status: packageRecord.status,
      source: this.packageSource(packageRecord.prealert_id),
    };
  }

  private prealertMatchSnapshot(
    prealert: Pick<LockedPrealertRow, 'prealert_code'>,
    packageSummary: PackageMatchedSummary,
  ): Record<string, unknown> {
    return {
      prealertCode: prealert.prealert_code,
      matchedPackageId: packageSummary.id,
      matchedInternalTrackingNumber: packageSummary.internalTrackingNumber,
      status: 'MATCHED',
    };
  }

  private maskTracking(value: string): string {
    const trimmed = value.trim();

    if (trimmed.length <= 8) {
      return `${trimmed.slice(0, 2)}****${trimmed.slice(-2)}`;
    }

    return `${trimmed.slice(0, 4)}${'*'.repeat(Math.max(trimmed.length - 8, 4))}${trimmed.slice(-4)}`;
  }

  private collectUpdateChangedFields(
    current: LockedPackageRow,
    input: UpdatePackageRecord,
  ): string[] {
    const changed: string[] = [];

    if (
      input.customerId !== undefined &&
      input.customerId !== current.customer_id
    ) {
      changed.push('customerId');
    }

    if (
      input.externalTrackingNumber !== undefined &&
      input.externalTrackingNumber !== current.external_tracking_number
    ) {
      changed.push('externalTrackingNumber');
    }

    if (input.notes !== undefined && input.notes !== current.notes) {
      changed.push('notes');
    }

    return changed;
  }

  private async findPendingPrealertByTracking(
    tx: Prisma.TransactionClient,
    organizationId: string,
    externalTrackingNumberNormalized: string,
  ): Promise<LockedPrealertStateRow | null> {
    const rows = await tx.$queryRaw<LockedPrealertStateRow[]>(Prisma.sql`
      SELECT id, status, prealert_code
      FROM prealerts
      WHERE organization_id = ${organizationId}
        AND external_tracking_number_normalized = ${externalTrackingNumberNormalized}
        AND status = 'PENDING_ARRIVAL'
        AND deleted_at IS NULL
      FOR UPDATE
    `);

    return rows[0] ?? null;
  }

  private async lockPrealertForMatching(
    tx: Prisma.TransactionClient,
    organizationId: string,
    prealertId: string,
  ): Promise<LockedPrealertRow | null> {
    const rows = await tx.$queryRaw<LockedPrealertRow[]>(Prisma.sql`
      SELECT
        p.id,
        p.customer_id,
        p.external_tracking_number,
        p.external_tracking_number_normalized,
        p.prealert_code,
        p.store_name,
        p.status,
        c.status AS customer_status
      FROM prealerts p
      INNER JOIN customers c
        ON c.organization_id = p.organization_id
       AND c.id = p.customer_id
      WHERE p.organization_id = ${organizationId}
        AND p.id = ${prealertId}
        AND p.deleted_at IS NULL
      FOR UPDATE
    `);

    return rows[0] ?? null;
  }

  private async lockPrealertState(
    tx: Prisma.TransactionClient,
    organizationId: string,
    prealertId: string,
  ): Promise<LockedPrealertStateRow | null> {
    const rows = await tx.$queryRaw<LockedPrealertStateRow[]>(Prisma.sql`
      SELECT id, status, prealert_code
      FROM prealerts
      WHERE organization_id = ${organizationId}
        AND id = ${prealertId}
        AND deleted_at IS NULL
      FOR UPDATE
    `);

    return rows[0] ?? null;
  }

  private async lockPackage(
    tx: Prisma.TransactionClient,
    organizationId: string,
    packageId: string,
  ): Promise<LockedPackageRow | null> {
    const rows = await tx.$queryRaw<LockedPackageRow[]>(Prisma.sql`
      SELECT
        id,
        customer_id,
        prealert_id,
        internal_tracking_number,
        external_tracking_number,
        external_tracking_number_normalized,
        status,
        notes,
        cancellation_reason,
        cancelled_at,
        cancelled_by_employee_id
      FROM packages
      WHERE organization_id = ${organizationId}
        AND id = ${packageId}
        AND deleted_at IS NULL
      FOR UPDATE
    `);

    return rows[0] ?? null;
  }

  private isPackageCodeConflictError(error: unknown): boolean {
    return this.hasKnownTarget(
      error,
      'packages_organization_id_internal_tracking_number_key',
      'internal_tracking_number',
      'internalTrackingNumber',
      'organizationId',
    );
  }

  private isPackageTrackingConflictError(error: unknown): boolean {
    return this.hasKnownTarget(
      error,
      'packages_one_active_external_tracking_per_organization',
      'external_tracking_number_normalized',
      'externalTrackingNumberNormalized',
      'organizationId',
    );
  }

  private isPackagePrealertConflictError(error: unknown): boolean {
    return this.hasKnownTarget(
      error,
      'packages_one_active_prealert_per_organization',
      'prealert_id',
      'prealertId',
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
