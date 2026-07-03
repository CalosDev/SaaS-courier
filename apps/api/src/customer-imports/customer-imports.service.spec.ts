import { randomUUID } from 'node:crypto';
import {
  CustomerImportJobNotFoundError,
  CustomerImportValidationError,
  InvalidCustomerImportInputError,
} from './customer-imports.errors';
import { CustomerImportsService } from './customer-imports.service';
import type { CommandContext } from '../request-context/request-context.types';

describe('CustomerImportsService', () => {
  const commandContext: CommandContext = {
    organizationId: 'be24d4d5-507e-4787-bae5-857b9329bc2d',
    actorType: 'EMPLOYEE',
    actorUserId: '75478008-b40a-453a-940a-21717807cd5f',
    actorEmployeeId: '5d2ac89e-f83e-4e08-9fab-f99c53743eb8',
    source: 'IMPORT',
    requestId: '898e459e-5ed3-4138-9988-c70690c0180e',
    correlationId: '94d43d87-eafc-40b4-bca6-f1870e123c84',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };
  const repository = {
    createDraft: jest.fn(),
    listJobs: jest.fn(),
    findJobById: jest.fn(),
    findValidationConflicts: jest.fn(),
    saveValidationResult: jest.fn(),
    commitJob: jest.fn(),
    cancelJob: jest.fn(),
  };
  const service = new CustomerImportsService(repository);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a draft import with at most 250 rows', async () => {
    repository.createDraft.mockResolvedValueOnce({
      id: randomUUID(),
      status: 'DRAFT',
      totalRows: 2,
    });

    await service.create(
      'be24d4d5-507e-4787-bae5-857b9329bc2d',
      '5d2ac89e-f83e-4e08-9fab-f99c53743eb8',
      {
        name: '  Legacy July import  ',
        preserveCustomerCodes: true,
        rows: [
          {
            type: 'INDIVIDUAL',
            firstName: ' Ada ',
            lastName: ' Lovelace ',
            customerCode: ' cf-1000 ',
          },
          {
            type: 'BUSINESS',
            businessName: '  ACME Courier  ',
          },
        ],
      },
    );

    expect(repository.createDraft).toHaveBeenCalledWith({
      organizationId: 'be24d4d5-507e-4787-bae5-857b9329bc2d',
      createdByEmployeeId: '5d2ac89e-f83e-4e08-9fab-f99c53743eb8',
      name: 'Legacy July import',
      preserveCustomerCodes: true,
      rows: [
        {
          rowNumber: 1,
          rawData: {
            type: 'INDIVIDUAL',
            firstName: ' Ada ',
            lastName: ' Lovelace ',
            customerCode: ' cf-1000 ',
          },
        },
        {
          rowNumber: 2,
          rawData: {
            type: 'BUSINESS',
            businessName: '  ACME Courier  ',
          },
        },
      ],
    });
  });

  it('rejects more than 250 rows', async () => {
    await expect(
      service.create(
        '39192ee5-df52-4dc8-bcec-0cefe8dc9026',
        '711cd763-5bdc-459d-88a9-d8b37b4cdf0a',
        {
          preserveCustomerCodes: false,
          rows: Array.from({ length: 251 }, () => ({
            type: 'BUSINESS',
            businessName: 'ACME',
          })),
        },
      ),
    ).rejects.toBeInstanceOf(InvalidCustomerImportInputError);
  });

  it('validates a draft and marks duplicate preserved codes as invalid', async () => {
    repository.findJobById.mockResolvedValueOnce({
      id: randomUUID(),
      status: 'DRAFT',
      preserveCustomerCodes: true,
      rows: [
        {
          id: randomUUID(),
          rowNumber: 1,
          rawData: {
            type: 'INDIVIDUAL',
            firstName: 'Ada',
            lastName: 'Lovelace',
            customerCode: 'CF-1000',
          },
        },
        {
          id: randomUUID(),
          rowNumber: 2,
          rawData: {
            type: 'BUSINESS',
            businessName: 'ACME',
            customerCode: 'CF-1000',
          },
        },
      ],
    });
    repository.findValidationConflicts.mockResolvedValueOnce({
      customerCodes: [],
      customsIdentities: [],
    });
    repository.saveValidationResult.mockResolvedValueOnce({
      id: randomUUID(),
      status: 'VALIDATED',
      totalRows: 2,
      validRows: 1,
      invalidRows: 1,
    });

    await service.validate(
      '468ef59f-19ca-4189-a4a8-7fa306d761ca',
      '5fd2b6b2-d4e6-4e38-8a61-0a47ec84f7d1',
    );

    expect(repository.saveValidationResult).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: '468ef59f-19ca-4189-a4a8-7fa306d761ca',
        importJobId: '5fd2b6b2-d4e6-4e38-8a61-0a47ec84f7d1',
        validRows: 1,
        invalidRows: 1,
      }),
    );
  });

  it('does not allow commit when validation errors remain', async () => {
    repository.commitJob.mockRejectedValueOnce(
      new CustomerImportValidationError(),
    );

    await expect(
      service.commit(
        '0c1f97fc-b2c3-48d7-bb7e-6fb5b5e0de17',
        'ec22a69f-d78c-4557-8c5e-a13f0d6cafdb',
      ),
    ).rejects.toBeInstanceOf(CustomerImportValidationError);
  });

  it('throws not found when the import does not exist', async () => {
    repository.findJobById.mockResolvedValueOnce(null);

    await expect(
      service.getById(
        'd93779b8-6475-48bc-8f9c-85d5aa5d0edf',
        'c4b993c9-fab4-46b1-853f-8d26f2c06290',
      ),
    ).rejects.toBeInstanceOf(CustomerImportJobNotFoundError);
  });

  it('preserves the authenticated command context for every import transition', async () => {
    const importJobId = '5fd2b6b2-d4e6-4e38-8a61-0a47ec84f7d1';
    repository.createDraft.mockResolvedValueOnce({ id: importJobId });
    repository.findJobById.mockResolvedValueOnce({
      id: importJobId,
      status: 'DRAFT',
      preserveCustomerCodes: false,
      rows: [],
    });
    repository.findValidationConflicts.mockResolvedValueOnce({
      customerCodes: [],
      customsIdentities: [],
    });
    repository.saveValidationResult.mockResolvedValueOnce({ id: importJobId });
    repository.commitJob.mockResolvedValueOnce({ id: importJobId });
    repository.cancelJob.mockResolvedValueOnce({ id: importJobId });

    await service.create(
      commandContext.organizationId,
      commandContext.actorEmployeeId!,
      {
        preserveCustomerCodes: false,
        rows: [{ type: 'BUSINESS', businessName: 'ACME' }],
      },
      commandContext,
    );
    await service.validate(
      commandContext.organizationId,
      importJobId,
      commandContext,
    );
    await service.commit(
      commandContext.organizationId,
      importJobId,
      commandContext,
    );
    await service.cancel(
      commandContext.organizationId,
      importJobId,
      commandContext,
    );

    expect(repository.createDraft).toHaveBeenCalledWith(
      expect.any(Object),
      commandContext,
    );
    expect(repository.saveValidationResult).toHaveBeenCalledWith(
      expect.any(Object),
      commandContext,
    );
    expect(repository.commitJob).toHaveBeenCalledWith(
      commandContext.organizationId,
      importJobId,
      commandContext,
    );
    expect(repository.cancelJob).toHaveBeenCalledWith(
      commandContext.organizationId,
      importJobId,
      commandContext,
    );
  });
});
