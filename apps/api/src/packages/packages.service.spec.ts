import { CustomerNotFoundError } from '../customers/customer.errors';
import { CustomersRepository } from '../customers/customers.repository';
import type { CustomerRecord } from '../customers/customer.types';
import {
  InvalidPackageInputError,
  InvalidPackageStatusTransitionError,
  PackageCodeGenerationError,
  PackageCustomerUnavailableError,
  PackageImmutableError,
} from './package.errors';
import { PackagesRepository } from './packages.repository';
import { PackagesService } from './packages.service';
import type {
  CreateManualPackageRecord,
  CreatePackageFromPrealertRecord,
  PackageListResult,
  PackageRecord,
  UpdatePackageRecord,
} from './package.types';

function buildCustomerRecord(
  overrides: Partial<CustomerRecord> = {},
): CustomerRecord {
  const now = new Date('2026-07-03T00:00:00.000Z');

  return {
    id: '9c3cbc5f-993d-4a16-a4ab-c473c7c8bd15',
    customerCode: 'C7KMP4TX9',
    type: 'INDIVIDUAL',
    firstName: 'Ada',
    lastName: 'Lovelace',
    businessName: null,
    email: 'ada@courier.test',
    phone: null,
    mobilePhone: null,
    status: 'ACTIVE',
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function buildPackageRecord(
  overrides: Partial<PackageRecord> = {},
): PackageRecord {
  const now = new Date('2026-07-03T00:00:00.000Z');

  return {
    id: '7f53b64f-e287-4a3b-8a2b-05772f89c2f7',
    internalTrackingNumber: 'PK7KMP4TX9RW3Q',
    externalTrackingNumber: '1Z-999-AA1-01-2345-6784',
    status: 'RECEPTION_PENDING',
    source: 'MANUAL',
    notes: null,
    cancellationReason: null,
    cancelledAt: null,
    customer: {
      id: '9c3cbc5f-993d-4a16-a4ab-c473c7c8bd15',
      customerCode: 'C7KMP4TX9',
      type: 'INDIVIDUAL',
      displayName: 'Ada Lovelace',
    },
    prealert: null,
    registeredBy: {
      id: '96f31d98-7f6f-4b24-a312-7af803006674',
      displayName: 'Ada Lovelace',
    },
    cancelledBy: null,
    registeredAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('PackagesService', () => {
  const packagesRepository = {
    createManual: jest.fn<
      Promise<PackageRecord>,
      [CreateManualPackageRecord, unknown]
    >(),
    createFromPrealert: jest.fn<
      Promise<PackageRecord>,
      [CreatePackageFromPrealertRecord, unknown]
    >(),
    findById: jest.fn<Promise<PackageRecord | null>, [string, string]>(),
    list: jest.fn<Promise<PackageListResult>, [unknown]>(),
    update: jest.fn<
      Promise<PackageRecord | null>,
      [UpdatePackageRecord, unknown]
    >(),
    cancel: jest.fn<
      Promise<PackageRecord | null>,
      [string, string, string, unknown]
    >(),
  } as unknown as jest.Mocked<PackagesRepository>;
  const customersRepository = {
    findById: jest.fn<Promise<CustomerRecord | null>, [string, string]>(),
  } as unknown as jest.Mocked<CustomersRepository>;

  const service = new PackagesService(packagesRepository, customersRepository);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a manual package with normalized tracking', async () => {
    customersRepository.findById.mockResolvedValueOnce(buildCustomerRecord());
    packagesRepository.createManual.mockResolvedValueOnce(buildPackageRecord());

    await expect(
      service.create(
        'org-1',
        {
          customerId: 'customer-1',
          externalTrackingNumber: ' 1Z-999-AA1-01-2345-6784 ',
          notes: ' Handle with care ',
        },
        {
          organizationId: 'org-1',
          actorType: 'EMPLOYEE',
          actorUserId: 'user-1',
          actorEmployeeId: 'employee-1',
          source: 'HTTP',
          requestId: 'request-1',
          correlationId: 'correlation-1',
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
        },
      ),
    ).resolves.toEqual(buildPackageRecord());

    expect(packagesRepository.createManual.mock.calls[0]).toEqual([
      expect.objectContaining({
        organizationId: 'org-1',
        customerId: '9c3cbc5f-993d-4a16-a4ab-c473c7c8bd15',
        registeredByEmployeeId: 'employee-1',
        externalTrackingNumber: '1Z-999-AA1-01-2345-6784',
        externalTrackingNumberNormalized: '1Z999AA10123456784',
        notes: 'Handle with care',
      }),
      expect.any(Object),
    ]);
  });

  it('creates a package from a prealert without accepting manual fields', async () => {
    packagesRepository.createFromPrealert.mockResolvedValueOnce(
      buildPackageRecord({
        source: 'PREALERT',
        prealert: {
          id: 'prealert-1',
          prealertCode: 'PA7KMP4TX9RW',
          storeName: 'Amazon',
        },
      }),
    );

    await expect(
      service.create(
        'org-1',
        {
          prealertId: 'prealert-1',
          notes: '  Received at front desk  ',
        },
        {
          organizationId: 'org-1',
          actorType: 'EMPLOYEE',
          actorUserId: 'user-1',
          actorEmployeeId: 'employee-1',
          source: 'HTTP',
          requestId: 'request-1',
          correlationId: 'correlation-1',
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
        },
      ),
    ).resolves.toMatchObject({
      source: 'PREALERT',
    });

    expect(packagesRepository.createFromPrealert.mock.calls[0]).toEqual([
      {
        organizationId: 'org-1',
        prealertId: 'prealert-1',
        registeredByEmployeeId: 'employee-1',
        notes: 'Received at front desk',
      },
      expect.any(Object),
    ]);
  });

  it('rejects mixed prealert and manual payloads', async () => {
    await expect(
      service.create(
        'org-1',
        {
          prealertId: 'prealert-1',
          customerId: 'customer-1',
        },
        {
          organizationId: 'org-1',
          actorType: 'EMPLOYEE',
          actorUserId: 'user-1',
          actorEmployeeId: 'employee-1',
          source: 'HTTP',
          requestId: 'request-1',
          correlationId: 'correlation-1',
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
        },
      ),
    ).rejects.toBeInstanceOf(InvalidPackageInputError);
  });

  it('rejects suspended and closed customers for manual registration', async () => {
    customersRepository.findById.mockResolvedValueOnce(
      buildCustomerRecord({ status: 'SUSPENDED' }),
    );

    await expect(
      service.create(
        'org-1',
        {
          customerId: 'customer-1',
          externalTrackingNumber: '1Z999AA10123456784',
        },
        {
          organizationId: 'org-1',
          actorType: 'EMPLOYEE',
          actorUserId: 'user-1',
          actorEmployeeId: 'employee-1',
          source: 'HTTP',
          requestId: 'request-1',
          correlationId: 'correlation-1',
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
        },
      ),
    ).rejects.toBeInstanceOf(PackageCustomerUnavailableError);

    customersRepository.findById.mockResolvedValueOnce(
      buildCustomerRecord({ status: 'CLOSED' }),
    );

    await expect(
      service.create(
        'org-1',
        {
          customerId: 'customer-1',
          externalTrackingNumber: '1Z999AA10123456784',
        },
        {
          organizationId: 'org-1',
          actorType: 'EMPLOYEE',
          actorUserId: 'user-1',
          actorEmployeeId: 'employee-1',
          source: 'HTTP',
          requestId: 'request-1',
          correlationId: 'correlation-1',
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
        },
      ),
    ).rejects.toBeInstanceOf(PackageCustomerUnavailableError);
  });

  it('allows pending and active customers for manual registration', async () => {
    customersRepository.findById.mockResolvedValueOnce(
      buildCustomerRecord({ status: 'PENDING' }),
    );
    packagesRepository.createManual.mockResolvedValueOnce(buildPackageRecord());

    await expect(
      service.create(
        'org-1',
        {
          customerId: 'customer-1',
          externalTrackingNumber: '1Z999AA10123456784',
        },
        {
          organizationId: 'org-1',
          actorType: 'EMPLOYEE',
          actorUserId: 'user-1',
          actorEmployeeId: 'employee-1',
          source: 'HTTP',
          requestId: 'request-1',
          correlationId: 'correlation-1',
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
        },
      ),
    ).resolves.toMatchObject({
      internalTrackingNumber: 'PK7KMP4TX9RW3Q',
    });
  });

  it('throws not found when the referenced customer is missing', async () => {
    customersRepository.findById.mockResolvedValueOnce(null);

    await expect(
      service.create(
        'org-1',
        {
          customerId: 'missing',
          externalTrackingNumber: '1Z999AA10123456784',
        },
        {
          organizationId: 'org-1',
          actorType: 'EMPLOYEE',
          actorUserId: 'user-1',
          actorEmployeeId: 'employee-1',
          source: 'HTTP',
          requestId: 'request-1',
          correlationId: 'correlation-1',
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
        },
      ),
    ).rejects.toBeInstanceOf(CustomerNotFoundError);
  });

  it('updates manual packages with normalized tracking', async () => {
    packagesRepository.findById.mockResolvedValueOnce(buildPackageRecord());
    customersRepository.findById.mockResolvedValueOnce(buildCustomerRecord());
    packagesRepository.update.mockResolvedValueOnce(
      buildPackageRecord({
        externalTrackingNumber: '9400-1111-1111-1111-1111-11',
        notes: 'Updated notes',
      }),
    );

    await expect(
      service.update(
        'org-1',
        'package-1',
        {
          customerId: 'customer-1',
          externalTrackingNumber: ' 9400-1111-1111-1111-1111-11 ',
          notes: ' Updated notes ',
        },
        {
          organizationId: 'org-1',
          actorType: 'EMPLOYEE',
          actorUserId: 'user-1',
          actorEmployeeId: 'employee-1',
          source: 'HTTP',
          requestId: 'request-1',
          correlationId: 'correlation-1',
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
        },
      ),
    ).resolves.toMatchObject({
      notes: 'Updated notes',
    });

    expect(packagesRepository.update.mock.calls[0]).toEqual([
      expect.objectContaining({
        packageId: 'package-1',
        customerId: '9c3cbc5f-993d-4a16-a4ab-c473c7c8bd15',
        externalTrackingNumber: '9400-1111-1111-1111-1111-11',
        externalTrackingNumberNormalized: '9400111111111111111111',
        notes: 'Updated notes',
      }),
      expect.any(Object),
    ]);
  });

  it('restricts customer and tracking updates for packages linked to prealerts', async () => {
    packagesRepository.findById.mockResolvedValueOnce(
      buildPackageRecord({
        source: 'PREALERT',
        prealert: {
          id: 'prealert-1',
          prealertCode: 'PA7KMP4TX9RW',
          storeName: 'Amazon',
        },
      }),
    );

    await expect(
      service.update('org-1', 'package-1', {
        externalTrackingNumber: 'LX123456789US',
      }),
    ).rejects.toBeInstanceOf(InvalidPackageStatusTransitionError);
  });

  it('refuses to update cancelled packages', async () => {
    packagesRepository.findById.mockResolvedValueOnce(
      buildPackageRecord({ status: 'CANCELLED' }),
    );

    await expect(
      service.update('org-1', 'package-1', {
        notes: 'Should fail',
      }),
    ).rejects.toBeInstanceOf(PackageImmutableError);
  });

  it('passes cancellation reasons through to the repository', async () => {
    packagesRepository.cancel.mockResolvedValueOnce(
      buildPackageRecord({
        status: 'CANCELLED',
        cancellationReason: 'Duplicate identification record',
        cancelledAt: new Date('2026-07-03T12:00:00.000Z'),
        cancelledBy: {
          id: 'employee-1',
          displayName: 'Ada Lovelace',
        },
      }),
    );

    await service.cancel(
      'org-1',
      'package-1',
      {
        reason: '  Duplicate identification record  ',
      },
      {
        organizationId: 'org-1',
        actorType: 'EMPLOYEE',
        actorUserId: 'user-1',
        actorEmployeeId: 'employee-1',
        source: 'HTTP',
        requestId: 'request-1',
        correlationId: 'correlation-1',
        ipAddress: null,
        userAgent: null,
      },
    );

    expect(packagesRepository.cancel.mock.calls[0]).toEqual([
      'org-1',
      'package-1',
      'Duplicate identification record',
      expect.any(Object),
    ]);
  });

  it('surfaces safe code generation failures', async () => {
    customersRepository.findById.mockResolvedValueOnce(buildCustomerRecord());
    packagesRepository.createManual.mockRejectedValueOnce(
      new PackageCodeGenerationError(),
    );

    await expect(
      service.create(
        'org-1',
        {
          customerId: 'customer-1',
          externalTrackingNumber: '1Z999AA10123456784',
        },
        {
          organizationId: 'org-1',
          actorType: 'EMPLOYEE',
          actorUserId: 'user-1',
          actorEmployeeId: 'employee-1',
          source: 'HTTP',
          requestId: 'request-1',
          correlationId: 'correlation-1',
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
        },
      ),
    ).rejects.toBeInstanceOf(PackageCodeGenerationError);
  });
});
