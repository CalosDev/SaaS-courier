import { CustomerNotFoundError } from '../customers/customer.errors';
import type { CustomerRecord } from '../customers/customer.types';
import {
  PrealertCodeGenerationError,
  PrealertCustomerUnavailableError,
  PrealertImmutableError,
} from './prealert.errors';
import { CustomersRepository } from '../customers/customers.repository';
import { OrganizationsService } from '../organizations/organizations.service';
import { PrealertsService } from './prealerts.service';
import { PrealertsRepository } from './prealerts.repository';
import type {
  CreatePrealertRecord,
  PrealertListResult,
  PrealertRecord,
  UpdatePrealertRecord,
} from './prealert.types';

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

function buildPrealertRecord(
  overrides: Partial<PrealertRecord> = {},
): PrealertRecord {
  const now = new Date('2026-07-03T00:00:00.000Z');

  return {
    id: 'ad91238e-b71f-4dd9-ad1f-43f82ece6a62',
    prealertCode: 'PA7KMP4TX9RW',
    customerId: '9c3cbc5f-993d-4a16-a4ab-c473c7c8bd15',
    externalTrackingNumber: '1Z 999 AA1 01 2345 6784',
    carrierName: 'UPS',
    storeName: 'Amazon',
    purchaseDate: new Date('2026-07-01T00:00:00.000Z'),
    description: 'Laptop sleeve',
    quantity: 1,
    declaredValue: '49.99',
    currencyCode: 'USD',
    invoiceStatus: 'PENDING',
    status: 'PENDING_ARRIVAL',
    notes: null,
    cancellationReason: null,
    cancelledAt: null,
    customer: {
      id: '9c3cbc5f-993d-4a16-a4ab-c473c7c8bd15',
      customerCode: 'C7KMP4TX9',
      type: 'INDIVIDUAL',
      displayName: 'Ada Lovelace',
    },
    matchedPackage: null,
    createdBy: {
      id: '96f31d98-7f6f-4b24-a312-7af803006674',
      displayName: 'Ada Lovelace',
    },
    cancelledBy: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('PrealertsService', () => {
  const prealertsRepository = {
    create: jest.fn<Promise<PrealertRecord>, [CreatePrealertRecord, unknown]>(),
    findById: jest.fn<Promise<PrealertRecord | null>, [string, string]>(),
    list: jest.fn<Promise<PrealertListResult>, [unknown]>(),
    update: jest.fn<
      Promise<PrealertRecord | null>,
      [UpdatePrealertRecord, unknown]
    >(),
    cancel: jest.fn<
      Promise<PrealertRecord | null>,
      [string, string, string, unknown]
    >(),
  } as unknown as jest.Mocked<PrealertsRepository>;
  const customersRepository = {
    findById: jest.fn<Promise<CustomerRecord | null>, [string, string]>(),
  } as unknown as jest.Mocked<CustomersRepository>;
  const organizationsService = {
    getById: jest.fn<Promise<{ currencyCode: string }>, [string]>(),
  } as unknown as jest.Mocked<OrganizationsService>;

  const service = new PrealertsService(
    prealertsRepository,
    customersRepository,
    organizationsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    organizationsService.getById.mockResolvedValue({
      currencyCode: 'DOP',
    } as never);
  });

  it('creates a prealert with normalized tracking and default organization currency', async () => {
    customersRepository.findById.mockResolvedValueOnce(buildCustomerRecord());
    prealertsRepository.create.mockResolvedValueOnce(buildPrealertRecord());

    await expect(
      service.create(
        'a627d973-d2ef-46b9-a9bc-f2afb6ac6826',
        {
          customerId: '9c3cbc5f-993d-4a16-a4ab-c473c7c8bd15',
          externalTrackingNumber: ' 1Z-999-AA1-01-2345-6784 ',
          carrierName: '  UPS ',
          storeName: ' Amazon ',
          description: ' Laptop sleeve ',
          quantity: 1,
          declaredValue: '49.99',
          invoiceStatus: 'PENDING',
        },
        {
          organizationId: 'a627d973-d2ef-46b9-a9bc-f2afb6ac6826',
          actorType: 'EMPLOYEE',
          actorUserId: 'f1af3c17-a5c3-4cea-8ebe-35f771668b1b',
          actorEmployeeId: '96f31d98-7f6f-4b24-a312-7af803006674',
          source: 'HTTP',
          requestId: '6382d4dc-7eef-40b3-b0e9-eb804f46c4ca',
          correlationId: 'corr-prealert-create',
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
        },
      ),
    ).resolves.toEqual(buildPrealertRecord());

    expect(prealertsRepository.create.mock.calls[0]).toEqual([
      expect.objectContaining({
        organizationId: 'a627d973-d2ef-46b9-a9bc-f2afb6ac6826',
        customerId: '9c3cbc5f-993d-4a16-a4ab-c473c7c8bd15',
        createdByEmployeeId: '96f31d98-7f6f-4b24-a312-7af803006674',
        externalTrackingNumber: '1Z-999-AA1-01-2345-6784',
        externalTrackingNumberNormalized: '1Z999AA10123456784',
        carrierName: 'UPS',
        storeName: 'Amazon',
        description: 'Laptop sleeve',
        quantity: 1,
        declaredValue: '49.99',
        currencyCode: 'DOP',
        invoiceStatus: 'PENDING',
        status: 'PENDING_ARRIVAL',
      }),
      expect.any(Object),
    ]);
  });

  it('rejects suspended and closed customers for new prealerts', async () => {
    customersRepository.findById.mockResolvedValueOnce(
      buildCustomerRecord({ status: 'SUSPENDED' }),
    );

    await expect(
      service.create('org-1', {
        customerId: 'customer-1',
        externalTrackingNumber: '1Z999AA10123456784',
        storeName: 'Amazon',
        description: 'Keyboard',
        quantity: 1,
        declaredValue: '49.99',
        invoiceStatus: 'PENDING',
      }),
    ).rejects.toBeInstanceOf(PrealertCustomerUnavailableError);

    customersRepository.findById.mockResolvedValueOnce(
      buildCustomerRecord({ status: 'CLOSED' }),
    );

    await expect(
      service.create('org-1', {
        customerId: 'customer-1',
        externalTrackingNumber: '1Z999AA10123456784',
        storeName: 'Amazon',
        description: 'Keyboard',
        quantity: 1,
        declaredValue: '49.99',
        invoiceStatus: 'PENDING',
      }),
    ).rejects.toBeInstanceOf(PrealertCustomerUnavailableError);
  });

  it('allows active and pending customers for new prealerts', async () => {
    customersRepository.findById.mockResolvedValueOnce(
      buildCustomerRecord({ status: 'PENDING' }),
    );
    prealertsRepository.create.mockResolvedValueOnce(buildPrealertRecord());

    await expect(
      service.create('org-1', {
        customerId: 'customer-1',
        externalTrackingNumber: '1Z999AA10123456784',
        storeName: 'Amazon',
        description: 'Keyboard',
        quantity: 1,
        declaredValue: '49.99',
        invoiceStatus: 'PENDING',
      }),
    ).resolves.toMatchObject({
      prealertCode: 'PA7KMP4TX9RW',
    });
  });

  it('throws not found when the referenced customer is missing', async () => {
    customersRepository.findById.mockResolvedValueOnce(null);

    await expect(
      service.create('org-1', {
        customerId: 'missing',
        externalTrackingNumber: '1Z999AA10123456784',
        storeName: 'Amazon',
        description: 'Keyboard',
        quantity: 1,
        declaredValue: '49.99',
        invoiceStatus: 'PENDING',
      }),
    ).rejects.toBeInstanceOf(CustomerNotFoundError);
  });

  it('refuses to update a cancelled prealert', async () => {
    prealertsRepository.findById.mockResolvedValueOnce(
      buildPrealertRecord({ status: 'CANCELLED' }),
    );

    await expect(
      service.update('org-1', 'prealert-1', {
        description: 'Updated description',
      }),
    ).rejects.toBeInstanceOf(PrealertImmutableError);
  });

  it('passes cancellation reasons through to the repository', async () => {
    prealertsRepository.cancel.mockResolvedValueOnce(
      buildPrealertRecord({
        status: 'CANCELLED',
        cancellationReason: 'Customer cancelled the purchase',
        cancelledAt: new Date('2026-07-03T12:00:00.000Z'),
        cancelledBy: {
          id: '96f31d98-7f6f-4b24-a312-7af803006674',
          displayName: 'Ada Lovelace',
        },
      }),
    );

    await service.cancel(
      'org-1',
      'prealert-1',
      {
        reason: '  Customer cancelled the purchase  ',
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

    expect(prealertsRepository.cancel.mock.calls[0]).toEqual([
      'org-1',
      'prealert-1',
      'Customer cancelled the purchase',
      expect.any(Object),
    ]);
  });

  it('surfaces safe code generation failures', async () => {
    customersRepository.findById.mockResolvedValueOnce(buildCustomerRecord());
    prealertsRepository.create.mockRejectedValueOnce(
      new PrealertCodeGenerationError(),
    );

    await expect(
      service.create('org-1', {
        customerId: 'customer-1',
        externalTrackingNumber: '1Z999AA10123456784',
        storeName: 'Amazon',
        description: 'Keyboard',
        quantity: 1,
        declaredValue: '49.99',
        invoiceStatus: 'PENDING',
      }),
    ).rejects.toBeInstanceOf(PrealertCodeGenerationError);
  });
});
