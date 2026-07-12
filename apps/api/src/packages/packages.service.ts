import { Inject, Injectable, Optional } from '@nestjs/common';

import {
  ExternalTrackingNormalizationError,
  ExternalTrackingNormalizer,
} from '../common/tracking/external-tracking-normalizer';
import { CustomerNotFoundError } from '../customers/customer.errors';
import { CustomersRepository } from '../customers/customers.repository';
import { OperationalHoldGuard } from '../holds/operational-hold.guard';
import type { CustomerRecord } from '../customers/customer.types';
import type { CommandContext } from '../request-context/request-context.types';
import {
  InvalidPackageInputError,
  InvalidPackageStatusTransitionError,
  PackageCustomerUnavailableError,
  PackageImmutableError,
  PackageNotFoundError,
} from './package.errors';
import { PackagesRepository } from './packages.repository';
import type {
  CancelPackageInput,
  CreatePackageInput,
  ListPackagesInput,
  PackageListResult,
  PackageRecord,
  PackageSource,
  UpdatePackageInput,
  UpdatePackageRecord,
} from './package.types';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_REGISTERED_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

@Injectable()
export class PackagesService {
  constructor(
    @Inject(PackagesRepository)
    private readonly packagesRepository: PackagesRepository,
    @Inject(CustomersRepository)
    private readonly customersRepository: CustomersRepository,
    private readonly trackingNormalizer: ExternalTrackingNormalizer = new ExternalTrackingNormalizer(),
    @Optional()
    private readonly operationalHoldGuard?: OperationalHoldGuard,
  ) {}

  async create(
    organizationId: string,
    input: CreatePackageInput,
    context?: CommandContext,
  ): Promise<PackageRecord> {
    const normalizedOrganizationId = this.normalizeRequiredField(
      organizationId,
      'organizationId',
    );
    const registeredByEmployeeId = this.normalizeRequiredField(
      context?.actorEmployeeId,
      'actorEmployeeId',
    );
    const notes = this.normalizeOptionalField(input.notes);

    if (input.prealertId !== undefined) {
      if (
        input.customerId !== undefined ||
        input.externalTrackingNumber !== undefined
      ) {
        throw new InvalidPackageInputError(
          'Invalid package input: prealertId cannot be combined with manual package fields',
        );
      }

      return this.packagesRepository.createFromPrealert(
        {
          organizationId: normalizedOrganizationId,
          prealertId: this.normalizeRequiredField(
            input.prealertId,
            'prealertId',
          ),
          registeredByEmployeeId,
          notes,
        },
        context,
      );
    }

    if (
      input.customerId === undefined ||
      input.externalTrackingNumber === undefined
    ) {
      throw new InvalidPackageInputError(
        'Invalid package input: customerId and externalTrackingNumber are required for manual registration',
      );
    }

    const customer = await this.loadCustomer(
      normalizedOrganizationId,
      input.customerId,
    );
    this.ensureCustomerAvailable(customer);
    const tracking = this.normalizeTracking(input.externalTrackingNumber);

    return this.packagesRepository.createManual(
      {
        organizationId: normalizedOrganizationId,
        customerId: customer.id,
        registeredByEmployeeId,
        externalTrackingNumber: tracking.original,
        externalTrackingNumberNormalized: tracking.normalized,
        notes,
      },
      context,
    );
  }

  async getById(
    organizationId: string,
    packageId: string,
  ): Promise<PackageRecord> {
    const packageRecord = await this.packagesRepository.findById(
      this.normalizeRequiredField(organizationId, 'organizationId'),
      this.normalizeRequiredField(packageId, 'packageId'),
    );

    if (!packageRecord) {
      throw new PackageNotFoundError(packageId);
    }

    return packageRecord;
  }

  async list(
    organizationId: string,
    input: ListPackagesInput,
  ): Promise<PackageListResult> {
    const page = input.page ?? DEFAULT_PAGE;
    const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;

    if (!Number.isInteger(page) || page < 1) {
      throw new InvalidPackageInputError(
        'Invalid package input: page must be a positive integer',
      );
    }

    if (
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > MAX_PAGE_SIZE
    ) {
      throw new InvalidPackageInputError(
        'Invalid package input: pageSize is out of range',
      );
    }

    const registeredFrom = this.normalizeDateBoundary(input.registeredFrom);
    const registeredTo = this.normalizeDateBoundary(input.registeredTo);

    if (
      registeredFrom &&
      registeredTo &&
      (registeredFrom > registeredTo ||
        registeredTo.getTime() - registeredFrom.getTime() >
          MAX_REGISTERED_RANGE_MS)
    ) {
      throw new InvalidPackageInputError(
        'Invalid package input: registered date range is invalid',
      );
    }

    return this.packagesRepository.list({
      organizationId: this.normalizeRequiredField(
        organizationId,
        'organizationId',
      ),
      page,
      pageSize,
      q: this.normalizeSearchQuery(input.q),
      status: input.status,
      customerId:
        input.customerId !== undefined
          ? this.normalizeRequiredField(input.customerId, 'customerId')
          : undefined,
      prealertId:
        input.prealertId !== undefined
          ? this.normalizeRequiredField(input.prealertId, 'prealertId')
          : undefined,
      source: this.normalizeSource(input.source),
      registeredFrom,
      registeredTo,
    });
  }

  async update(
    organizationId: string,
    packageId: string,
    input: UpdatePackageInput,
    context?: CommandContext,
  ): Promise<PackageRecord> {
    const current = await this.getById(organizationId, packageId);

    if (current.status !== 'RECEPTION_PENDING') {
      throw new PackageImmutableError(packageId);
    }

    if (
      current.prealert &&
      (input.customerId !== undefined ||
        input.externalTrackingNumber !== undefined)
    ) {
      throw new InvalidPackageStatusTransitionError(
        'Packages linked to prealerts can only update notes',
      );
    }

    const record: UpdatePackageRecord = {
      organizationId: this.normalizeRequiredField(
        organizationId,
        'organizationId',
      ),
      packageId: this.normalizeRequiredField(packageId, 'packageId'),
    };

    if (input.customerId !== undefined) {
      const customer = await this.loadCustomer(
        organizationId,
        input.customerId,
      );
      this.ensureCustomerAvailable(customer);
      record.customerId = customer.id;
    }

    if (input.externalTrackingNumber !== undefined) {
      const tracking = this.normalizeTracking(input.externalTrackingNumber);
      record.externalTrackingNumber = tracking.original;
      record.externalTrackingNumberNormalized = tracking.normalized;
    }

    if (input.notes !== undefined) {
      record.notes = this.normalizeOptionalField(input.notes);
    }

    if (Object.keys(record).length === 2) {
      throw new InvalidPackageInputError(
        'Invalid package input: at least one field is required',
      );
    }

    await this.operationalHoldGuard?.assertNoActivePackageHolds(
      record.organizationId,
      record.packageId,
      { operation: 'package update' },
    );

    const updated = await this.packagesRepository.update(record, context);

    if (!updated) {
      throw new PackageNotFoundError(packageId);
    }

    return updated;
  }

  async cancel(
    organizationId: string,
    packageId: string,
    input: CancelPackageInput,
    context?: CommandContext,
  ): Promise<PackageRecord> {
    const reason = this.normalizeReason(input.reason);
    const normalizedOrganizationId = this.normalizeRequiredField(
      organizationId,
      'organizationId',
    );
    const normalizedPackageId = this.normalizeRequiredField(
      packageId,
      'packageId',
    );
    await this.operationalHoldGuard?.assertNoActivePackageHolds(
      normalizedOrganizationId,
      normalizedPackageId,
      { operation: 'package cancellation' },
    );

    const cancelled = await this.packagesRepository.cancel(
      normalizedOrganizationId,
      normalizedPackageId,
      reason,
      context,
    );

    if (!cancelled) {
      throw new PackageNotFoundError(packageId);
    }

    return cancelled;
  }

  private async loadCustomer(
    organizationId: string,
    customerId: string,
  ): Promise<CustomerRecord> {
    const customer = await this.customersRepository.findById(
      organizationId,
      this.normalizeRequiredField(customerId, 'customerId'),
    );

    if (!customer) {
      throw new CustomerNotFoundError(customerId);
    }

    return customer;
  }

  private ensureCustomerAvailable(customer: CustomerRecord): void {
    if (customer.status === 'SUSPENDED') {
      throw new PackageCustomerUnavailableError(
        'Package customer is suspended',
      );
    }

    if (customer.status === 'CLOSED') {
      throw new PackageCustomerUnavailableError('Package customer is closed');
    }
  }

  private normalizeTracking(value: unknown): {
    original: string;
    normalized: string;
  } {
    try {
      return this.trackingNormalizer.normalize(value);
    } catch (error) {
      if (
        error instanceof ExternalTrackingNormalizationError &&
        error.reason === 'required'
      ) {
        throw new InvalidPackageInputError(
          'Invalid package input: externalTrackingNumber is required',
        );
      }

      if (error instanceof ExternalTrackingNormalizationError) {
        throw new InvalidPackageInputError(
          'Invalid package input: externalTrackingNumber is invalid',
        );
      }

      throw error;
    }
  }

  private normalizeSource(value?: string): PackageSource | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === 'MANUAL' || value === 'PREALERT') {
      return value;
    }

    throw new InvalidPackageInputError(
      'Invalid package input: source is invalid',
    );
  }

  private normalizeRequiredField(
    value: string | undefined | null,
    field: string,
  ): string {
    if (typeof value !== 'string') {
      throw new InvalidPackageInputError(
        `Invalid package input: ${field} is required`,
      );
    }

    const normalizedValue = value.trim();

    if (!normalizedValue) {
      throw new InvalidPackageInputError(
        `Invalid package input: ${field} is required`,
      );
    }

    return normalizedValue;
  }

  private normalizeOptionalField(value?: string | null): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalizedValue = value.trim();
    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private normalizeSearchQuery(value?: string): string | undefined {
    const normalizedValue = this.normalizeOptionalField(value);

    return normalizedValue ?? undefined;
  }

  private normalizeDateBoundary(value?: string): Date | undefined {
    if (value === undefined) {
      return undefined;
    }

    const normalizedValue = this.normalizeRequiredField(value, 'dateBoundary');
    const parsed = new Date(normalizedValue);

    if (Number.isNaN(parsed.getTime())) {
      throw new InvalidPackageInputError(
        'Invalid package input: registered date is invalid',
      );
    }

    return parsed;
  }

  private normalizeReason(value: string): string {
    const normalizedValue = this.normalizeRequiredField(
      value,
      'cancellationReason',
    );

    if (normalizedValue.length < 3 || normalizedValue.length > 500) {
      throw new InvalidPackageInputError(
        'Invalid package input: cancellation reason is invalid',
      );
    }

    return normalizedValue;
  }
}
