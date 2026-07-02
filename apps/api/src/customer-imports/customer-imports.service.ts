import { Inject, Injectable } from '@nestjs/common';
import {
  CustomerImportJobNotFoundError,
  InvalidCustomerImportInputError,
} from './customer-imports.errors';
import { CustomerImportsRepository } from './customer-imports.repository';
import type {
  CreateCustomerImportJobInput,
  CreateCustomerImportJobRecord,
  CustomerImportJobRecord,
  CustomerImportRowInput,
  SaveCustomerImportValidationRecord,
} from './customer-imports.types';

const MAX_IMPORT_ROWS = 250;
const CUSTOMER_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;
const PASSPORT_PATTERN = /^[A-Z0-9-]{3,30}$/;

interface NormalizedCustomsProfile {
  documentType: string;
  documentNumber: string;
  notes: string | null;
}

@Injectable()
export class CustomerImportsService {
  constructor(
    @Inject(CustomerImportsRepository)
    private readonly customerImportsRepository: CustomerImportsRepository,
  ) {}

  async create(
    organizationId: string,
    createdByEmployeeId: string,
    input: CreateCustomerImportJobInput,
  ): Promise<CustomerImportJobRecord> {
    const record = this.normalizeCreateInput(
      organizationId,
      createdByEmployeeId,
      input,
    );

    return this.customerImportsRepository.createDraft(record);
  }

  async list(organizationId: string): Promise<CustomerImportJobRecord[]> {
    return this.customerImportsRepository.listJobs(
      this.normalizeRequiredField(organizationId, 'organizationId'),
    );
  }

  async getById(
    organizationId: string,
    importJobId: string,
  ): Promise<CustomerImportJobRecord> {
    const job = await this.customerImportsRepository.findJobById(
      this.normalizeRequiredField(organizationId, 'organizationId'),
      this.normalizeRequiredField(importJobId, 'importJobId'),
    );

    if (!job) {
      throw new CustomerImportJobNotFoundError(importJobId);
    }

    return job;
  }

  async validate(
    organizationId: string,
    importJobId: string,
  ): Promise<CustomerImportJobRecord> {
    const job = await this.getById(organizationId, importJobId);
    const rows = job.rows ?? [];
    const duplicateCodes = new Set<string>();
    const seenCodes = new Set<string>();
    const duplicateCustomsIdentities = new Set<string>();
    const seenCustomsIdentities = new Set<string>();
    const conflictInput = {
      organizationId,
      customerCodes: [] as string[],
      customsIdentities: [] as Array<{
        documentType: string;
        documentNumber: string;
      }>,
    };
    const normalizedRows: SaveCustomerImportValidationRecord['rows'] = [];

    for (const row of rows) {
      const normalized = this.normalizeRow(
        row.rawData,
        job.preserveCustomerCodes,
      );
      const validationErrors = [...normalized.validationErrors];

      if (normalized.normalizedData.customerCode) {
        const customerCode = normalized.normalizedData.customerCode as string;

        if (seenCodes.has(customerCode)) {
          duplicateCodes.add(customerCode);
          validationErrors.push('Duplicate customerCode within import job');
        } else {
          seenCodes.add(customerCode);
          conflictInput.customerCodes.push(customerCode);
        }
      }

      const customsProfile = normalized.normalizedData.customsProfile as
        | NormalizedCustomsProfile
        | undefined;

      if (customsProfile?.documentType && customsProfile.documentNumber) {
        const customsIdentity = `${customsProfile.documentType}:${customsProfile.documentNumber}`;

        if (seenCustomsIdentities.has(customsIdentity)) {
          duplicateCustomsIdentities.add(customsIdentity);
          validationErrors.push('Duplicate customs identity within import job');
        } else {
          seenCustomsIdentities.add(customsIdentity);
        }

        conflictInput.customsIdentities.push({
          documentType: customsProfile.documentType,
          documentNumber: customsProfile.documentNumber,
        });
      }

      normalizedRows.push({
        id: row.id,
        status: validationErrors.length > 0 ? 'INVALID' : 'VALID',
        normalizedData: normalized.normalizedData,
        validationErrors: validationErrors.length > 0 ? validationErrors : null,
      });
    }

    const conflicts =
      await this.customerImportsRepository.findValidationConflicts(
        conflictInput,
      );

    const updatedRows = normalizedRows.map((row) => {
      const nextErrors = [...(row.validationErrors ?? [])];
      const customerCode = row.normalizedData?.customerCode;
      const customsProfile = row.normalizedData?.customsProfile as
        | NormalizedCustomsProfile
        | undefined;
      const customsIdentity = customsProfile?.documentType
        ? `${customsProfile.documentType}:${customsProfile.documentNumber}`
        : null;

      if (
        typeof customerCode === 'string' &&
        conflicts.customerCodes.includes(customerCode)
      ) {
        nextErrors.push('customerCode already exists');
      }

      if (
        customsIdentity &&
        (conflicts.customsIdentities.includes(customsIdentity) ||
          duplicateCustomsIdentities.has(customsIdentity))
      ) {
        nextErrors.push('customs identity already exists');
      }

      return {
        ...row,
        status:
          nextErrors.length > 0 ? ('INVALID' as const) : ('VALID' as const),
        validationErrors: nextErrors.length > 0 ? nextErrors : null,
      };
    });
    const validRows = updatedRows.filter(
      (row) => row.status === 'VALID',
    ).length;
    const invalidRows = updatedRows.length - validRows;

    return this.customerImportsRepository.saveValidationResult({
      organizationId: this.normalizeRequiredField(
        organizationId,
        'organizationId',
      ),
      importJobId: this.normalizeRequiredField(importJobId, 'importJobId'),
      validRows,
      invalidRows,
      rows: updatedRows,
    });
  }

  async commit(
    organizationId: string,
    importJobId: string,
  ): Promise<CustomerImportJobRecord> {
    return this.customerImportsRepository.commitJob(
      this.normalizeRequiredField(organizationId, 'organizationId'),
      this.normalizeRequiredField(importJobId, 'importJobId'),
    );
  }

  async cancel(
    organizationId: string,
    importJobId: string,
  ): Promise<CustomerImportJobRecord> {
    const job = await this.customerImportsRepository.cancelJob(
      this.normalizeRequiredField(organizationId, 'organizationId'),
      this.normalizeRequiredField(importJobId, 'importJobId'),
    );

    if (!job) {
      throw new CustomerImportJobNotFoundError(importJobId);
    }

    return job;
  }

  private normalizeCreateInput(
    organizationId: string,
    createdByEmployeeId: string,
    input: CreateCustomerImportJobInput,
  ): CreateCustomerImportJobRecord {
    if (!Array.isArray(input.rows) || input.rows.length === 0) {
      throw new InvalidCustomerImportInputError(
        'Invalid customer import input: rows are required',
      );
    }

    if (input.rows.length > MAX_IMPORT_ROWS) {
      throw new InvalidCustomerImportInputError(
        'Invalid customer import input: rows exceed the limit of 250',
      );
    }

    return {
      organizationId: this.normalizeRequiredField(
        organizationId,
        'organizationId',
      ),
      createdByEmployeeId: this.normalizeRequiredField(
        createdByEmployeeId,
        'createdByEmployeeId',
      ),
      name: this.normalizeOptionalField(input.name),
      preserveCustomerCodes: input.preserveCustomerCodes === true,
      rows: input.rows.map((row, index) => ({
        rowNumber: index + 1,
        rawData: row,
      })),
    };
  }

  private normalizeRow(
    row: CustomerImportRowInput,
    preserveCustomerCodes: boolean,
  ): {
    normalizedData: Record<string, unknown>;
    validationErrors: string[];
  } {
    const validationErrors: string[] = [];
    const normalizedData: Record<string, unknown> = {
      type: row.type,
      firstName: this.normalizeOptionalField(row.firstName),
      lastName: this.normalizeOptionalField(row.lastName),
      businessName: this.normalizeOptionalField(row.businessName),
      email: this.normalizeOptionalField(row.email)?.toLowerCase() ?? null,
      phone: this.normalizeOptionalField(row.phone),
      mobilePhone: this.normalizeOptionalField(row.mobilePhone),
      notes: this.normalizeOptionalField(row.notes),
    };

    if (row.type !== 'INDIVIDUAL' && row.type !== 'BUSINESS') {
      validationErrors.push('type is invalid');
    }

    if (row.type === 'INDIVIDUAL') {
      if (!normalizedData.firstName) {
        validationErrors.push('firstName is required for individuals');
      }

      if (!normalizedData.lastName) {
        validationErrors.push('lastName is required for individuals');
      }
    }

    if (row.type === 'BUSINESS' && !normalizedData.businessName) {
      validationErrors.push('businessName is required for businesses');
    }

    const rawCode = this.normalizeOptionalField(
      row.customerCode,
    )?.toUpperCase();

    if (rawCode) {
      if (!preserveCustomerCodes) {
        validationErrors.push(
          'customerCode is not allowed when preserveCustomerCodes is false',
        );
      } else if (!CUSTOMER_CODE_PATTERN.test(rawCode)) {
        validationErrors.push('customerCode format is invalid');
      } else {
        normalizedData.customerCode = rawCode;
      }
    }

    if (row.customsProfile) {
      if (!row.customsProfile.documentType) {
        validationErrors.push('customsProfile.documentType is required');
      }

      if (!row.customsProfile.documentNumber) {
        validationErrors.push('customsProfile.documentNumber is required');
      }

      if (
        row.customsProfile.documentType &&
        row.customsProfile.documentNumber
      ) {
        try {
          normalizedData.customsProfile = {
            documentType: this.normalizeCustomsDocumentType(
              row.customsProfile.documentType,
            ),
            documentNumber: this.normalizeCustomsDocumentNumber(
              row.customsProfile.documentType,
              row.customsProfile.documentNumber,
            ),
            notes: this.normalizeOptionalField(row.customsProfile.notes),
          };
        } catch (error) {
          validationErrors.push(
            error instanceof Error
              ? error.message
              : 'customsProfile is invalid',
          );
        }
      }
    }

    return {
      normalizedData,
      validationErrors,
    };
  }

  private normalizeRequiredField(value: string, field: string): string {
    if (typeof value !== 'string') {
      throw new InvalidCustomerImportInputError(
        `Invalid customer import input: ${field} is required`,
      );
    }

    const normalized = value.trim();

    if (!normalized) {
      throw new InvalidCustomerImportInputError(
        `Invalid customer import input: ${field} is required`,
      );
    }

    return normalized;
  }

  private normalizeOptionalField(value?: string): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();

    return normalized.length > 0 ? normalized : null;
  }

  private normalizeCustomsDocumentType(value: string): string {
    if (value === 'CEDULA' || value === 'PASSPORT' || value === 'RNC') {
      return value;
    }

    throw new InvalidCustomerImportInputError(
      'customsProfile.documentType is invalid',
    );
  }

  private normalizeCustomsDocumentNumber(type: string, value: string): string {
    const normalized = this.normalizeRequiredField(
      value,
      'customsProfile.documentNumber',
    );

    if (type === 'CEDULA') {
      const digits = normalized.replace(/\D/g, '');

      if (!/^\d{11}$/.test(digits)) {
        throw new InvalidCustomerImportInputError(
          'customsProfile.documentNumber is invalid',
        );
      }

      return digits;
    }

    if (type === 'RNC') {
      const digits = normalized.replace(/\D/g, '');

      if (!/^(\d{9}|\d{11})$/.test(digits)) {
        throw new InvalidCustomerImportInputError(
          'customsProfile.documentNumber is invalid',
        );
      }

      return digits;
    }

    const passport = normalized.toUpperCase();

    if (!PASSPORT_PATTERN.test(passport)) {
      throw new InvalidCustomerImportInputError(
        'customsProfile.documentNumber is invalid',
      );
    }

    return passport;
  }
}
