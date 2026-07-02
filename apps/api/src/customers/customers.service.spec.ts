import {
  CustomerCodeGenerationError,
  CustomerNotFoundError,
  InvalidCustomerInputError,
} from './customer.errors';
import type {
  CreateCustomerRecord,
  CustomerListResult,
  CustomerRecord,
  ListCustomersRecord,
  UpdateCustomerRecord,
} from './customer.types';
import { CustomersService } from './customers.service';

function buildCustomerRecord(
  overrides: Partial<CustomerRecord> = {},
): CustomerRecord {
  const now = new Date('2026-07-01T00:00:00.000Z');

  return {
    id: '7bd7a310-c780-4e45-a6f2-c3bcd7bf72d1',
    customerCode: 'C7KMP4TX9',
    type: 'INDIVIDUAL',
    firstName: 'Ada',
    lastName: 'Lovelace',
    businessName: null,
    email: 'ada@courier.test',
    phone: '809-555-0101',
    mobilePhone: '809-555-0102',
    status: 'PENDING',
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('CustomersService', () => {
  const customersRepository = {
    create: jest.fn<Promise<CustomerRecord>, [CreateCustomerRecord]>(),
    createWithGeneratedCode: jest.fn<
      Promise<CustomerRecord>,
      [Omit<CreateCustomerRecord, 'customerCode'>]
    >(),
    findById: jest.fn<Promise<CustomerRecord | null>, [string, string]>(),
    list: jest.fn<Promise<CustomerListResult>, [ListCustomersRecord]>(),
    update: jest.fn<Promise<CustomerRecord | null>, [UpdateCustomerRecord]>(),
  };
  const service = new CustomersService(customersRepository);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a valid INDIVIDUAL customer', async () => {
    const customer = buildCustomerRecord();
    customersRepository.createWithGeneratedCode.mockResolvedValueOnce(customer);

    await expect(
      service.create('95de12bf-18d0-48d1-b2dd-33c65b954f3d', {
        type: 'INDIVIDUAL',
        firstName: '  Ada ',
        lastName: ' Lovelace  ',
        email: '  Ada@Courier.Test ',
        phone: ' 809-555-0101 ',
      }),
    ).resolves.toEqual(customer);

    expect(customersRepository.createWithGeneratedCode).toHaveBeenCalledWith({
      organizationId: '95de12bf-18d0-48d1-b2dd-33c65b954f3d',
      type: 'INDIVIDUAL',
      firstName: 'Ada',
      lastName: 'Lovelace',
      businessName: null,
      email: 'ada@courier.test',
      phone: '809-555-0101',
      mobilePhone: null,
      status: 'PENDING',
      notes: null,
    });
  });

  it('creates a valid BUSINESS customer', async () => {
    const customer = buildCustomerRecord({
      type: 'BUSINESS',
      firstName: null,
      lastName: null,
      businessName: 'ACME Courier',
    });
    customersRepository.createWithGeneratedCode.mockResolvedValueOnce(customer);

    await service.create('345c13f5-5920-4bd7-9fa6-5a52c0e7dcfe', {
      type: 'BUSINESS',
      businessName: '  ACME Courier  ',
      email: '  CONTACT@ACME.TEST ',
    });

    expect(customersRepository.createWithGeneratedCode).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: '345c13f5-5920-4bd7-9fa6-5a52c0e7dcfe',
        type: 'BUSINESS',
        firstName: null,
        lastName: null,
        businessName: 'ACME Courier',
        email: 'contact@acme.test',
      }),
    );
  });

  it('rejects an INDIVIDUAL without names', async () => {
    await expect(
      service.create('6b215c6f-6aef-4de5-b89b-3d4f5d69751e', {
        type: 'INDIVIDUAL',
        firstName: '   ',
        lastName: 'Lovelace',
      }),
    ).rejects.toBeInstanceOf(InvalidCustomerInputError);

    await expect(
      service.create('6b215c6f-6aef-4de5-b89b-3d4f5d69751e', {
        type: 'INDIVIDUAL',
        firstName: 'Ada',
        lastName: '   ',
      }),
    ).rejects.toBeInstanceOf(InvalidCustomerInputError);
  });

  it('rejects a BUSINESS without businessName', async () => {
    await expect(
      service.create('1b1f738d-889c-4b6c-8060-c9de11e1260a', {
        type: 'BUSINESS',
        businessName: '   ',
      }),
    ).rejects.toBeInstanceOf(InvalidCustomerInputError);
  });

  it('normalizes email and optional fields', async () => {
    customersRepository.createWithGeneratedCode.mockResolvedValueOnce(
      buildCustomerRecord({
        email: null,
        phone: null,
        mobilePhone: null,
        notes: null,
      }),
    );

    await service.create('72efbbd6-3a7d-4e72-a1ba-89c8a0be16a4', {
      type: 'INDIVIDUAL',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: '   ',
      phone: '   ',
      mobilePhone: '   ',
      notes: '   ',
    });

    expect(customersRepository.createWithGeneratedCode).toHaveBeenCalledWith(
      expect.objectContaining({
        email: null,
        phone: null,
        mobilePhone: null,
        notes: null,
      }),
    );
  });

  it('does not accept customerCode from HTTP input', async () => {
    customersRepository.createWithGeneratedCode.mockResolvedValueOnce(
      buildCustomerRecord(),
    );
    const inputWithCustomerCode = {
      type: 'INDIVIDUAL' as const,
      firstName: 'Ada',
      lastName: 'Lovelace',
      customerCode: 'MANUAL-001',
    };

    await service.create(
      '1f96d22e-aac4-49ee-9e4f-4ebc92070ea0',
      inputWithCustomerCode,
    );

    const createCall = customersRepository.createWithGeneratedCode.mock
      .calls[0]?.[0] as Record<string, unknown> | undefined;

    expect(createCall).toBeDefined();
    expect(createCall).not.toHaveProperty('customerCode');
  });

  it('updates only allowed fields', async () => {
    const customer = buildCustomerRecord({
      email: 'updated@courier.test',
      status: 'ACTIVE',
    });
    customersRepository.update.mockResolvedValueOnce(customer);

    await service.update(
      'e657fc92-f718-44dd-b805-cc6f96113282',
      '7bd7a310-c780-4e45-a6f2-c3bcd7bf72d1',
      {
        firstName: '  Ada  ',
        email: '  Updated@Courier.Test ',
        status: 'ACTIVE',
      },
    );

    expect(customersRepository.update).toHaveBeenCalledWith({
      organizationId: 'e657fc92-f718-44dd-b805-cc6f96113282',
      customerId: '7bd7a310-c780-4e45-a6f2-c3bcd7bf72d1',
      firstName: 'Ada',
      email: 'updated@courier.test',
      status: 'ACTIVE',
    });
  });

  it('lists customers with pagination and a trimmed search query', async () => {
    customersRepository.list.mockResolvedValueOnce({
      items: [buildCustomerRecord()],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
    });

    const result = await service.list('e0d51a84-5bca-431f-a0e8-368fe7b76962', {
      q: '  ada  ',
    });

    expect(result.pagination).toMatchObject({
      page: 1,
      pageSize: 20,
    });

    expect(customersRepository.list).toHaveBeenCalledWith({
      organizationId: 'e0d51a84-5bca-431f-a0e8-368fe7b76962',
      page: 1,
      pageSize: 20,
      q: 'ada',
      type: undefined,
      status: undefined,
    });
  });

  it('uses the provided organizationId to load a customer', async () => {
    const customer = buildCustomerRecord();
    customersRepository.findById.mockResolvedValueOnce(customer);

    await expect(
      service.getById(
        'b1f11d5d-b4b1-4dc0-ae2b-71c6db45440a',
        '7bd7a310-c780-4e45-a6f2-c3bcd7bf72d1',
      ),
    ).resolves.toEqual(customer);

    expect(customersRepository.findById).toHaveBeenCalledWith(
      'b1f11d5d-b4b1-4dc0-ae2b-71c6db45440a',
      '7bd7a310-c780-4e45-a6f2-c3bcd7bf72d1',
    );
  });

  it('throws not found when the customer does not exist', async () => {
    customersRepository.findById.mockResolvedValueOnce(null);

    await expect(
      service.getById(
        '47f2c5be-e38f-4b90-8438-7f7ef5ea94d4',
        '7bd7a310-c780-4e45-a6f2-c3bcd7bf72d1',
      ),
    ).rejects.toBeInstanceOf(CustomerNotFoundError);
  });

  it('fails safely when a customerCode cannot be generated after retries', async () => {
    customersRepository.createWithGeneratedCode.mockRejectedValue(
      new CustomerCodeGenerationError(),
    );

    await expect(
      service.create('534eb83f-e15f-4a32-83ab-bbdc28b2daf5', {
        type: 'INDIVIDUAL',
        firstName: 'Ada',
        lastName: 'Lovelace',
      }),
    ).rejects.toBeInstanceOf(CustomerCodeGenerationError);
  });
});
