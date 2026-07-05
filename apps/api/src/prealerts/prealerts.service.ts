import { Inject, Injectable } from '@nestjs/common';

import {
  ExternalTrackingNormalizationError,
  ExternalTrackingNormalizer,
} from '../common/tracking/external-tracking-normalizer';
import { CustomerNotFoundError } from '../customers/customer.errors';
import { CustomersRepository } from '../customers/customers.repository';
import type { CustomerRecord } from '../customers/customer.types';
import { OrganizationsService } from '../organizations/organizations.service';
import type { CommandContext } from '../request-context/request-context.types';
import {
  InvalidPrealertInputError,
  PrealertCustomerUnavailableError,
  PrealertImmutableError,
  PrealertNotFoundError,
} from './prealert.errors';
import { PrealertsRepository } from './prealerts.repository';
import type {
  CancelPrealertInput,
  CreatePrealertInput,
  ListPrealertsInput,
  PrealertInvoiceStatus,
  PrealertListResult,
  PrealertRecord,
  UpdatePrealertInput,
  UpdatePrealertRecord,
} from './prealert.types';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_CREATED_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

@Injectable()
export class PrealertsService {
  constructor(
    @Inject(PrealertsRepository)
    private readonly prealertsRepository: PrealertsRepository,
    @Inject(CustomersRepository)
    private readonly customersRepository: CustomersRepository,
    private readonly organizationsService: OrganizationsService,
    private readonly trackingNormalizer: ExternalTrackingNormalizer = new ExternalTrackingNormalizer(),
  ) {}

  async create(
    organizationId: string,
    input: CreatePrealertInput,
    context?: CommandContext,
  ): Promise<PrealertRecord> {
    const customer = await this.loadCustomer(
      this.normalizeRequiredField(organizationId, 'organizationId'),
      this.normalizeRequiredField(input.customerId, 'customerId'),
    );
    this.ensureCustomerCanCreatePrealert(customer);
    const tracking = this.normalizeTracking(input.externalTrackingNumber);
    const organization =
      await this.organizationsService.getById(organizationId);

    return this.prealertsRepository.create(
      {
        organizationId,
        customerId: customer.id,
        createdByEmployeeId:
          context?.actorEmployeeId ??
          this.normalizeRequiredField(organizationId, 'createdByEmployeeId'),
        externalTrackingNumber: tracking.original,
        externalTrackingNumberNormalized: tracking.normalized,
        carrierName: this.normalizeOptionalField(input.carrierName),
        storeName: this.normalizeStoreName(input.storeName),
        purchaseDate: this.normalizePurchaseDate(input.purchaseDate),
        description: this.normalizeDescription(input.description),
        quantity: this.normalizeQuantity(input.quantity),
        declaredValue: this.normalizeDeclaredValue(input.declaredValue),
        currencyCode: this.normalizeCurrencyCode(
          input.currencyCode ?? organization.currencyCode,
        ),
        invoiceStatus: this.normalizeInvoiceStatus(
          input.invoiceStatus ?? 'PENDING',
        ),
        status: 'PENDING_ARRIVAL',
        notes: this.normalizeOptionalField(input.notes),
      },
      context,
    );
  }

  async getById(
    organizationId: string,
    prealertId: string,
  ): Promise<PrealertRecord> {
    const prealert = await this.prealertsRepository.findById(
      this.normalizeRequiredField(organizationId, 'organizationId'),
      this.normalizeRequiredField(prealertId, 'prealertId'),
    );

    if (!prealert) {
      throw new PrealertNotFoundError(prealertId);
    }

    return prealert;
  }

  async list(
    organizationId: string,
    input: ListPrealertsInput,
  ): Promise<PrealertListResult> {
    const page = input.page ?? DEFAULT_PAGE;
    const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;

    if (!Number.isInteger(page) || page < 1) {
      throw new InvalidPrealertInputError(
        'Invalid prealert input: page must be a positive integer',
      );
    }

    if (
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > MAX_PAGE_SIZE
    ) {
      throw new InvalidPrealertInputError(
        'Invalid prealert input: pageSize is out of range',
      );
    }

    const createdFrom = this.normalizeDateBoundary(input.createdFrom);
    const createdTo = this.normalizeDateBoundary(input.createdTo);

    if (
      createdFrom &&
      createdTo &&
      (createdFrom > createdTo ||
        createdTo.getTime() - createdFrom.getTime() > MAX_CREATED_RANGE_MS)
    ) {
      throw new InvalidPrealertInputError(
        'Invalid prealert input: created date range is invalid',
      );
    }

    return this.prealertsRepository.list({
      organizationId: this.normalizeRequiredField(
        organizationId,
        'organizationId',
      ),
      page,
      pageSize,
      q: this.normalizeSearchQuery(input.q),
      status: input.status,
      invoiceStatus: input.invoiceStatus,
      customerId: input.customerId
        ? this.normalizeRequiredField(input.customerId, 'customerId')
        : undefined,
      createdFrom,
      createdTo,
    });
  }

  async update(
    organizationId: string,
    prealertId: string,
    input: UpdatePrealertInput,
    context?: CommandContext,
  ): Promise<PrealertRecord> {
    const current = await this.getById(organizationId, prealertId);

    if (current.status !== 'PENDING_ARRIVAL') {
      throw new PrealertImmutableError(prealertId);
    }

    const record: UpdatePrealertRecord = {
      organizationId: this.normalizeRequiredField(
        organizationId,
        'organizationId',
      ),
      prealertId: this.normalizeRequiredField(prealertId, 'prealertId'),
    };

    if (input.customerId !== undefined) {
      const customer = await this.loadCustomer(
        organizationId,
        input.customerId,
      );
      this.ensureCustomerCanCreatePrealert(customer);
      record.customerId = customer.id;
    }

    if (input.externalTrackingNumber !== undefined) {
      const tracking = this.normalizeTracking(input.externalTrackingNumber);
      record.externalTrackingNumber = tracking.original;
      record.externalTrackingNumberNormalized = tracking.normalized;
    }

    if (input.carrierName !== undefined) {
      record.carrierName = this.normalizeOptionalField(input.carrierName);
    }

    if (input.storeName !== undefined) {
      record.storeName = this.normalizeStoreName(input.storeName);
    }

    if (input.purchaseDate !== undefined) {
      record.purchaseDate = this.normalizePurchaseDate(input.purchaseDate);
    }

    if (input.description !== undefined) {
      record.description = this.normalizeDescription(input.description);
    }

    if (input.quantity !== undefined) {
      record.quantity = this.normalizeQuantity(input.quantity);
    }

    if (input.declaredValue !== undefined) {
      record.declaredValue = this.normalizeDeclaredValue(input.declaredValue);
    }

    if (input.currencyCode !== undefined) {
      record.currencyCode = this.normalizeCurrencyCode(input.currencyCode);
    }

    if (input.invoiceStatus !== undefined) {
      record.invoiceStatus = this.normalizeInvoiceStatus(input.invoiceStatus);
    }

    if (input.notes !== undefined) {
      record.notes = this.normalizeOptionalField(input.notes);
    }

    if (Object.keys(record).length === 2) {
      throw new InvalidPrealertInputError(
        'Invalid prealert input: at least one field is required',
      );
    }

    const updated = await this.prealertsRepository.update(record, context);

    if (!updated) {
      throw new PrealertNotFoundError(prealertId);
    }

    return updated;
  }

  async cancel(
    organizationId: string,
    prealertId: string,
    input: CancelPrealertInput,
    context?: CommandContext,
  ): Promise<PrealertRecord> {
    const reason = this.normalizeReason(input.reason);
    const cancelled = await this.prealertsRepository.cancel(
      this.normalizeRequiredField(organizationId, 'organizationId'),
      this.normalizeRequiredField(prealertId, 'prealertId'),
      reason,
      context,
    );

    if (!cancelled) {
      throw new PrealertNotFoundError(prealertId);
    }

    return cancelled;
  }

  private async loadCustomer(
    organizationId: string,
    customerId: string,
  ): Promise<CustomerRecord> {
    const customer = await this.customersRepository.findById(
      organizationId,
      customerId,
    );

    if (!customer) {
      throw new CustomerNotFoundError(customerId);
    }

    return customer;
  }

  private ensureCustomerCanCreatePrealert(customer: CustomerRecord): void {
    if (customer.status === 'SUSPENDED') {
      throw new PrealertCustomerUnavailableError(
        'Prealert customer is suspended',
      );
    }

    if (customer.status === 'CLOSED') {
      throw new PrealertCustomerUnavailableError('Prealert customer is closed');
    }
  }

  private normalizeRequiredField(value: string, field: string): string {
    if (typeof value !== 'string') {
      throw new InvalidPrealertInputError(
        `Invalid prealert input: ${field} is required`,
      );
    }

    const normalizedValue = value.trim();

    if (!normalizedValue) {
      throw new InvalidPrealertInputError(
        `Invalid prealert input: ${field} is required`,
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

  private normalizeStoreName(value: string): string {
    const normalizedValue = this.normalizeRequiredField(value, 'storeName');

    if (normalizedValue.length < 2 || normalizedValue.length > 160) {
      throw new InvalidPrealertInputError(
        'Invalid prealert input: storeName is invalid',
      );
    }

    return normalizedValue;
  }

  private normalizeDescription(value: string): string {
    const normalizedValue = this.normalizeRequiredField(value, 'description');

    if (normalizedValue.length < 3 || normalizedValue.length > 500) {
      throw new InvalidPrealertInputError(
        'Invalid prealert input: description is invalid',
      );
    }

    return normalizedValue;
  }

  private normalizeQuantity(value: number): number {
    if (!Number.isInteger(value) || value < 1 || value > 999) {
      throw new InvalidPrealertInputError(
        'Invalid prealert input: quantity is invalid',
      );
    }

    return value;
  }

  private normalizeDeclaredValue(value: string | number): string {
    const candidate =
      typeof value === 'number' ? value.toFixed(2) : String(value).trim();

    if (!/^\d+(?:\.\d{1,2})?$/.test(candidate)) {
      throw new InvalidPrealertInputError(
        'Invalid prealert input: declaredValue is invalid',
      );
    }

    const parsed = Number(candidate);

    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 9999999999.99) {
      throw new InvalidPrealertInputError(
        'Invalid prealert input: declaredValue is invalid',
      );
    }

    return parsed.toFixed(2);
  }

  private normalizeCurrencyCode(value: string): string {
    const normalizedValue = this.normalizeRequiredField(
      value,
      'currencyCode',
    ).toUpperCase();

    if (!/^[A-Z]{3}$/.test(normalizedValue)) {
      throw new InvalidPrealertInputError(
        'Invalid prealert input: currencyCode is invalid',
      );
    }

    return normalizedValue;
  }

  private normalizeInvoiceStatus(value: string): PrealertInvoiceStatus {
    switch (value) {
      case 'NOT_REQUIRED':
      case 'PENDING':
      case 'PROVIDED':
      case 'REJECTED':
      case 'VERIFIED':
        return value;
      default:
        throw new InvalidPrealertInputError(
          'Invalid prealert input: invoiceStatus is invalid',
        );
    }
  }

  private normalizePurchaseDate(value?: string | null): Date | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalizedValue = this.normalizeRequiredField(value, 'purchaseDate');
    const parsed = new Date(`${normalizedValue}T00:00:00.000Z`);

    if (Number.isNaN(parsed.getTime())) {
      throw new InvalidPrealertInputError(
        'Invalid prealert input: purchaseDate is invalid',
      );
    }

    const today = new Date();
    const todayUtc = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );
    const parsedUtc = Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    );

    if (parsedUtc > todayUtc) {
      throw new InvalidPrealertInputError(
        'Invalid prealert input: purchaseDate cannot be in the future',
      );
    }

    const minDate = new Date();
    minDate.setUTCFullYear(minDate.getUTCFullYear() - 10);

    if (parsed < minDate) {
      throw new InvalidPrealertInputError(
        'Invalid prealert input: purchaseDate is too old',
      );
    }

    return parsed;
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
      throw new InvalidPrealertInputError(
        'Invalid prealert input: created date is invalid',
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
      throw new InvalidPrealertInputError(
        'Invalid prealert input: cancellation reason is invalid',
      );
    }

    return normalizedValue;
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
        throw new InvalidPrealertInputError(
          'Invalid prealert input: externalTrackingNumber is required',
        );
      }

      if (error instanceof ExternalTrackingNormalizationError) {
        throw new InvalidPrealertInputError(
          'Invalid prealert input: externalTrackingNumber is invalid',
        );
      }

      throw error;
    }
  }
}
