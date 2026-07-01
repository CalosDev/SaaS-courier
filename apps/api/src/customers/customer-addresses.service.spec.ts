import {
  CustomerAddressNotFoundError,
  CustomerNotFoundError,
  InvalidCustomerInputError,
} from './customer.errors';
import { CustomerAddressesService } from './customer-addresses.service';

function buildAddressRecord(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-07-01T00:00:00.000Z');

  return {
    id: 'f9018072-b14e-45b8-ab4d-a7ebc12e742d',
    customerId: '75b63cc8-fdb1-4bd3-81fa-d6f673569455',
    type: 'HOME',
    label: null,
    recipientName: null,
    phone: null,
    addressLine1: 'Calle 1',
    addressLine2: null,
    city: 'Santo Domingo',
    province: 'Distrito Nacional',
    postalCode: null,
    countryCode: 'DO',
    isPrimary: false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('CustomerAddressesService', () => {
  const customerAddressesRepository = {
    listByCustomerId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const service = new CustomerAddressesService(customerAddressesRepository);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies DO by default when creating an address', async () => {
    customerAddressesRepository.create.mockResolvedValueOnce(
      buildAddressRecord(),
    );

    await service.create(
      'cd0569d0-0831-4bf0-8077-c4f26ad0d97f',
      '75b63cc8-fdb1-4bd3-81fa-d6f673569455',
      {
        type: 'HOME',
        addressLine1: 'Calle 1',
        city: 'Santo Domingo',
        province: 'Distrito Nacional',
      },
    );

    expect(customerAddressesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'cd0569d0-0831-4bf0-8077-c4f26ad0d97f',
        customerId: '75b63cc8-fdb1-4bd3-81fa-d6f673569455',
        countryCode: 'DO',
      }),
    );
  });

  it('normalizes countryCode to uppercase', async () => {
    customerAddressesRepository.create.mockResolvedValueOnce(
      buildAddressRecord(),
    );

    await service.create(
      'cd0569d0-0831-4bf0-8077-c4f26ad0d97f',
      '75b63cc8-fdb1-4bd3-81fa-d6f673569455',
      {
        type: 'WORK',
        addressLine1: 'Calle 2',
        city: 'Santiago',
        province: 'Santiago',
        countryCode: ' us ',
      },
    );

    expect(customerAddressesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        countryCode: 'US',
      }),
    );
  });

  it('rejects empty required fields', async () => {
    await expect(
      service.create(
        'cd0569d0-0831-4bf0-8077-c4f26ad0d97f',
        '75b63cc8-fdb1-4bd3-81fa-d6f673569455',
        {
          type: 'HOME',
          addressLine1: '   ',
          city: 'Santo Domingo',
          province: 'Distrito Nacional',
        },
      ),
    ).rejects.toBeInstanceOf(InvalidCustomerInputError);

    await expect(
      service.create(
        'cd0569d0-0831-4bf0-8077-c4f26ad0d97f',
        '75b63cc8-fdb1-4bd3-81fa-d6f673569455',
        {
          type: 'HOME',
          addressLine1: 'Calle 1',
          city: '   ',
          province: 'Distrito Nacional',
        },
      ),
    ).rejects.toBeInstanceOf(InvalidCustomerInputError);
  });

  it('creates a primary address', async () => {
    customerAddressesRepository.create.mockResolvedValueOnce(
      buildAddressRecord({
        isPrimary: true,
      }),
    );

    await service.create(
      '8ea8ec99-7ce3-449d-b495-796bbd7a3117',
      '75b63cc8-fdb1-4bd3-81fa-d6f673569455',
      {
        type: 'DELIVERY',
        addressLine1: 'Calle 3',
        city: 'Santo Domingo',
        province: 'Distrito Nacional',
        isPrimary: true,
      },
    );

    expect(customerAddressesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        isPrimary: true,
      }),
    );
  });

  it('updates an address using organizationId, customerId, and addressId', async () => {
    customerAddressesRepository.update.mockResolvedValueOnce(
      buildAddressRecord({
        label: 'Casa',
        isPrimary: true,
      }),
    );

    await service.update(
      '8ea8ec99-7ce3-449d-b495-796bbd7a3117',
      '75b63cc8-fdb1-4bd3-81fa-d6f673569455',
      'f9018072-b14e-45b8-ab4d-a7ebc12e742d',
      {
        label: '  Casa  ',
        isPrimary: true,
      },
    );

    expect(customerAddressesRepository.update).toHaveBeenCalledWith({
      organizationId: '8ea8ec99-7ce3-449d-b495-796bbd7a3117',
      customerId: '75b63cc8-fdb1-4bd3-81fa-d6f673569455',
      addressId: 'f9018072-b14e-45b8-ab4d-a7ebc12e742d',
      label: 'Casa',
      isPrimary: true,
    });
  });

  it('throws not found when the address does not exist', async () => {
    customerAddressesRepository.update.mockResolvedValueOnce(null);

    await expect(
      service.update(
        '8ea8ec99-7ce3-449d-b495-796bbd7a3117',
        '75b63cc8-fdb1-4bd3-81fa-d6f673569455',
        'f9018072-b14e-45b8-ab4d-a7ebc12e742d',
        {
          label: 'Casa',
        },
      ),
    ).rejects.toBeInstanceOf(CustomerAddressNotFoundError);
  });

  it('throws not found when listing addresses for a missing customer', async () => {
    customerAddressesRepository.listByCustomerId.mockRejectedValueOnce(
      new CustomerNotFoundError('75b63cc8-fdb1-4bd3-81fa-d6f673569455'),
    );

    await expect(
      service.listByCustomerId(
        '8ea8ec99-7ce3-449d-b495-796bbd7a3117',
        '75b63cc8-fdb1-4bd3-81fa-d6f673569455',
      ),
    ).rejects.toBeInstanceOf(CustomerNotFoundError);
  });
});
