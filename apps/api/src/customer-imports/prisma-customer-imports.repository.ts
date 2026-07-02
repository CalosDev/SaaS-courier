import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type CustomerImportJob,
  type CustomerImportRow,
  type OrganizationSettings,
} from '../generated/prisma/client';
import { CustomerCodeService } from '../customers/customer-code.service';
import { CustomerCodeGenerationError } from '../customers/customer.errors';
import { PrismaService } from '../prisma/prisma.service';
import {
  CustomerImportJobNotFoundError,
  CustomerImportStateConflictError,
  CustomerImportValidationError,
} from './customer-imports.errors';
import { CustomerImportsRepository } from './customer-imports.repository';
import type {
  CreateCustomerImportJobRecord,
  CustomerImportJobRecord,
  CustomerImportValidationConflictSnapshot,
  SaveCustomerImportValidationRecord,
} from './customer-imports.types';

type CustomerImportJobWithRows = CustomerImportJob & {
  rows: CustomerImportRow[];
};

const SEQUENTIAL_CODE_GENERATION_ATTEMPTS = 1000;
const RANDOM_CODE_GENERATION_ATTEMPTS = 10;

@Injectable()
export class PrismaCustomerImportsRepository implements CustomerImportsRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly customerCodeService: CustomerCodeService,
  ) {}

  async createDraft(
    input: CreateCustomerImportJobRecord,
  ): Promise<CustomerImportJobRecord> {
    const job = await this.prismaService.customerImportJob.create({
      data: {
        organization: {
          connect: {
            id: input.organizationId,
          },
        },
        createdByEmployee: {
          connect: {
            organizationId_id: {
              organizationId: input.organizationId,
              id: input.createdByEmployeeId,
            },
          },
        },
        name: input.name,
        status: 'DRAFT',
        preserveCustomerCodes: input.preserveCustomerCodes,
        totalRows: input.rows.length,
        validRows: 0,
        invalidRows: 0,
        importedRows: 0,
        rows: {
          create: input.rows.map((row) => ({
            rowNumber: row.rowNumber,
            rawData: row.rawData as Prisma.InputJsonValue,
            status: 'PENDING',
          })),
        },
      },
      include: {
        rows: {
          orderBy: [{ rowNumber: 'asc' }],
        },
      },
    });

    return this.toJobRecord(job);
  }

  async listJobs(organizationId: string): Promise<CustomerImportJobRecord[]> {
    const jobs = await this.prismaService.customerImportJob.findMany({
      where: {
        organizationId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return jobs.map((job) => this.toJobRecord(job));
  }

  async findJobById(
    organizationId: string,
    importJobId: string,
  ): Promise<CustomerImportJobRecord | null> {
    const job = await this.prismaService.customerImportJob.findFirst({
      where: {
        organizationId,
        id: importJobId,
      },
      include: {
        rows: {
          orderBy: [{ rowNumber: 'asc' }],
        },
      },
    });

    return job ? this.toJobRecord(job) : null;
  }

  async findValidationConflicts(input: {
    organizationId: string;
    customerCodes: string[];
    customsIdentities: Array<{
      documentType: string;
      documentNumber: string;
    }>;
  }): Promise<CustomerImportValidationConflictSnapshot> {
    const [customers, profiles] = await this.prismaService.$transaction([
      this.prismaService.customer.findMany({
        where: {
          organizationId: input.organizationId,
          deletedAt: null,
          customerCode: {
            in: input.customerCodes.length > 0 ? input.customerCodes : [''],
          },
        },
        select: {
          customerCode: true,
        },
      }),
      this.prismaService.customerCustomsProfile.findMany({
        where: {
          organizationId: input.organizationId,
          OR:
            input.customsIdentities.length > 0
              ? input.customsIdentities.map((identity) => ({
                  documentType: identity.documentType as never,
                  documentNumber: identity.documentNumber,
                }))
              : undefined,
        },
        select: {
          documentType: true,
          documentNumber: true,
        },
      }),
    ]);

    return {
      customerCodes: customers.map((customer) => customer.customerCode),
      customsIdentities: profiles.map(
        (profile) => `${profile.documentType}:${profile.documentNumber}`,
      ),
    };
  }

  async saveValidationResult(
    input: SaveCustomerImportValidationRecord,
  ): Promise<CustomerImportJobRecord> {
    return this.prismaService.$transaction(async (tx) => {
      for (const row of input.rows) {
        await tx.customerImportRow.update({
          where: {
            id: row.id,
          },
          data: {
            status: row.status,
            normalizedData:
              row.normalizedData === null
                ? Prisma.DbNull
                : (row.normalizedData as Prisma.InputJsonValue),
            validationErrors:
              row.validationErrors === null
                ? Prisma.DbNull
                : (row.validationErrors as Prisma.InputJsonValue),
          },
        });
      }

      const summary = {
        totalRows: input.rows.length,
        validRows: input.validRows,
        invalidRows: input.invalidRows,
      };

      await tx.customerImportJob.update({
        where: {
          id: input.importJobId,
        },
        data: {
          status: 'VALIDATED',
          validRows: input.validRows,
          invalidRows: input.invalidRows,
          validationSummary: summary,
          validatedAt: new Date(),
          failureCode: null,
        },
      });

      const job = await tx.customerImportJob.findFirstOrThrow({
        where: {
          organizationId: input.organizationId,
          id: input.importJobId,
        },
        include: {
          rows: {
            orderBy: [{ rowNumber: 'asc' }],
          },
        },
      });

      return this.toJobRecord(job);
    });
  }

  async commitJob(
    organizationId: string,
    importJobId: string,
  ): Promise<CustomerImportJobRecord> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        const job = await this.lockJob(tx, organizationId, importJobId);

        if (job.status === 'COMPLETED') {
          return this.toJobRecord(job);
        }

        if (job.status === 'CANCELLED' || job.status === 'IMPORTING') {
          throw new CustomerImportStateConflictError(
            `Customer import job cannot be committed from status ${job.status}`,
          );
        }

        if (
          job.status !== 'VALIDATED' ||
          job.invalidRows > 0 ||
          job.validRows !== job.totalRows
        ) {
          throw new CustomerImportValidationError();
        }

        await tx.customerImportJob.update({
          where: {
            id: job.id,
          },
          data: {
            status: 'IMPORTING',
            startedAt: new Date(),
            failureCode: null,
          },
        });

        for (const row of job.rows) {
          if (row.status !== 'VALID') {
            throw new CustomerImportValidationError();
          }

          const normalizedData = row.normalizedData as Record<string, unknown>;
          const customer = await this.createImportedCustomer(
            tx,
            organizationId,
            normalizedData,
            job.preserveCustomerCodes,
          );

          if (normalizedData.customsProfile) {
            const customsProfile = normalizedData.customsProfile as Record<
              string,
              unknown
            >;
            await tx.customerCustomsProfile.create({
              data: {
                organizationId,
                customerId: customer.id,
                documentType: customsProfile.documentType as never,
                documentNumber: customsProfile.documentNumber as string,
                ruaStatus: 'UNKNOWN',
                verificationSource: null,
                lastCheckedAt: null,
                verifiedAt: null,
                externalReference: null,
                notes:
                  typeof customsProfile.notes === 'string'
                    ? customsProfile.notes
                    : null,
              },
            });
          }

          await tx.customerImportRow.update({
            where: {
              id: row.id,
            },
            data: {
              status: 'IMPORTED',
              importedCustomerId: customer.id,
            },
          });
        }

        await tx.customerImportJob.update({
          where: {
            id: job.id,
          },
          data: {
            status: 'COMPLETED',
            importedRows: job.totalRows,
            completedAt: new Date(),
          },
        });

        const completedJob = await this.lockJob(
          tx,
          organizationId,
          importJobId,
        );

        return this.toJobRecord(completedJob);
      });
    } catch (error) {
      if (
        error instanceof CustomerImportJobNotFoundError ||
        error instanceof CustomerImportStateConflictError ||
        error instanceof CustomerImportValidationError
      ) {
        throw error;
      }

      await this.prismaService.customerImportJob.updateMany({
        where: {
          organizationId,
          id: importJobId,
          status: {
            notIn: ['COMPLETED', 'CANCELLED'],
          },
        },
        data: {
          status: 'FAILED',
          failureCode: 'IMPORT_COMMIT_FAILED',
        },
      });

      throw error;
    }
  }

  async cancelJob(
    organizationId: string,
    importJobId: string,
  ): Promise<CustomerImportJobRecord | null> {
    return this.prismaService.$transaction(async (tx) => {
      const job = await this.lockJob(tx, organizationId, importJobId, false);

      if (!job) {
        return null;
      }

      if (job.status === 'COMPLETED' || job.status === 'IMPORTING') {
        throw new CustomerImportStateConflictError(
          `Customer import job cannot be cancelled from status ${job.status}`,
        );
      }

      if (job.status === 'CANCELLED') {
        return this.toJobRecord(job);
      }

      await tx.customerImportJob.update({
        where: {
          id: job.id,
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      });

      const cancelledJob = await this.lockJob(tx, organizationId, importJobId);

      return this.toJobRecord(cancelledJob);
    });
  }

  private async lockJob(
    tx: Prisma.TransactionClient,
    organizationId: string,
    importJobId: string,
    requireExisting = true,
  ): Promise<CustomerImportJobWithRows> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM customer_import_jobs
      WHERE organization_id = ${organizationId}
        AND id = ${importJobId}
      FOR UPDATE
    `);

    if (rows.length === 0) {
      if (requireExisting) {
        throw new CustomerImportJobNotFoundError(importJobId);
      }

      return null as never;
    }

    return tx.customerImportJob.findFirstOrThrow({
      where: {
        organizationId,
        id: importJobId,
      },
      include: {
        rows: {
          orderBy: [{ rowNumber: 'asc' }],
        },
      },
    });
  }

  private async createImportedCustomer(
    tx: Prisma.TransactionClient,
    organizationId: string,
    normalizedData: Record<string, unknown>,
    preserveCustomerCodes: boolean,
  ) {
    const customerCode =
      preserveCustomerCodes && typeof normalizedData.customerCode === 'string'
        ? normalizedData.customerCode
        : null;

    if (customerCode) {
      return tx.customer.create({
        data: {
          organizationId,
          customerCode,
          type: normalizedData.type as never,
          firstName: (normalizedData.firstName as string | null) ?? null,
          lastName: (normalizedData.lastName as string | null) ?? null,
          businessName: (normalizedData.businessName as string | null) ?? null,
          email: (normalizedData.email as string | null) ?? null,
          phone: (normalizedData.phone as string | null) ?? null,
          mobilePhone: (normalizedData.mobilePhone as string | null) ?? null,
          status: 'PENDING',
          notes: (normalizedData.notes as string | null) ?? null,
        },
      });
    }

    const settings = await this.lockSettings(tx, organizationId);

    if (settings.customerCodeStrategy === 'AUTO_SEQUENTIAL') {
      return this.createSequentialCustomer(
        tx,
        organizationId,
        normalizedData,
        settings,
      );
    }

    return this.createRandomCustomer(
      tx,
      organizationId,
      normalizedData,
      settings,
    );
  }

  private async createSequentialCustomer(
    tx: Prisma.TransactionClient,
    organizationId: string,
    normalizedData: Record<string, unknown>,
    settings: OrganizationSettings,
  ) {
    let nextSequence = Number(settings.nextCustomerSequence);

    for (
      let attempt = 0;
      attempt < SEQUENTIAL_CODE_GENERATION_ATTEMPTS;
      attempt += 1
    ) {
      const customerCode = this.customerCodeService.formatSequential({
        prefix: settings.customerCodePrefix,
        sequence: nextSequence,
        padding: settings.customerCodeSequencePadding,
      });

      try {
        const customer = await tx.customer.create({
          data: {
            organizationId,
            customerCode,
            type: normalizedData.type as never,
            firstName: (normalizedData.firstName as string | null) ?? null,
            lastName: (normalizedData.lastName as string | null) ?? null,
            businessName:
              (normalizedData.businessName as string | null) ?? null,
            email: (normalizedData.email as string | null) ?? null,
            phone: (normalizedData.phone as string | null) ?? null,
            mobilePhone: (normalizedData.mobilePhone as string | null) ?? null,
            status: 'PENDING',
            notes: (normalizedData.notes as string | null) ?? null,
          },
        });

        await tx.organizationSettings.update({
          where: {
            organizationId,
          },
          data: {
            nextCustomerSequence: BigInt(nextSequence + 1),
          },
        });

        return customer;
      } catch (error) {
        if (this.isCustomerCodeConflictError(error)) {
          nextSequence += 1;
          continue;
        }

        throw error;
      }
    }

    throw new CustomerCodeGenerationError();
  }

  private async createRandomCustomer(
    tx: Prisma.TransactionClient,
    organizationId: string,
    normalizedData: Record<string, unknown>,
    settings: OrganizationSettings,
  ) {
    for (
      let attempt = 0;
      attempt < RANDOM_CODE_GENERATION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await tx.customer.create({
          data: {
            organizationId,
            customerCode: this.customerCodeService.generateRandom({
              prefix: settings.customerCodePrefix,
              randomLength: settings.customerCodeRandomLength,
            }),
            type: normalizedData.type as never,
            firstName: (normalizedData.firstName as string | null) ?? null,
            lastName: (normalizedData.lastName as string | null) ?? null,
            businessName:
              (normalizedData.businessName as string | null) ?? null,
            email: (normalizedData.email as string | null) ?? null,
            phone: (normalizedData.phone as string | null) ?? null,
            mobilePhone: (normalizedData.mobilePhone as string | null) ?? null,
            status: 'PENDING',
            notes: (normalizedData.notes as string | null) ?? null,
          },
        });
      } catch (error) {
        if (this.isCustomerCodeConflictError(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new CustomerCodeGenerationError();
  }

  private async lockSettings(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<OrganizationSettings> {
    const rows = await tx.$queryRaw<
      Array<{ organization_id: string }>
    >(Prisma.sql`
      SELECT organization_id
      FROM organization_settings
      WHERE organization_id = ${organizationId}
      FOR UPDATE
    `);

    if (rows.length === 0) {
      throw new CustomerImportStateConflictError(
        'Customer import job cannot generate codes without organization settings',
      );
    }

    return tx.organizationSettings.findUniqueOrThrow({
      where: {
        organizationId,
      },
    });
  }

  private isCustomerCodeConflictError(error: unknown): boolean {
    if (!(error instanceof Error) || !('code' in error)) {
      return false;
    }

    const candidate = error as Error & {
      code?: unknown;
      meta?: { modelName?: unknown; target?: unknown };
    };

    if (candidate.code !== 'P2002') {
      return false;
    }

    const target = candidate.meta?.target;
    const targetText = Array.isArray(target)
      ? target.join(',')
      : typeof target === 'string'
        ? target
        : '';

    return (
      candidate.meta?.modelName === 'Customer' ||
      targetText.includes('customers_organization_id_customer_code_key') ||
      targetText.includes('customerCode')
    );
  }

  private toJobRecord(
    job: CustomerImportJob | CustomerImportJobWithRows,
  ): CustomerImportJobRecord {
    return {
      id: job.id,
      name: job.name,
      status: job.status,
      preserveCustomerCodes: job.preserveCustomerCodes,
      totalRows: job.totalRows,
      validRows: job.validRows,
      invalidRows: job.invalidRows,
      importedRows: job.importedRows,
      rows:
        'rows' in job
          ? job.rows.map((row) => ({
              id: row.id,
              rowNumber: row.rowNumber,
              rawData: row.rawData as Record<string, unknown>,
              normalizedData:
                (row.normalizedData as Record<string, unknown> | null) ?? null,
              status: row.status,
              validationErrors:
                (row.validationErrors as string[] | null) ?? null,
              importedCustomerId: row.importedCustomerId ?? null,
            }))
          : undefined,
    };
  }
}
