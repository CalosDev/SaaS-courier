import {
  CustomerCustomsProfileNotFoundError,
  CustomerIdentityConflictError,
  InvalidCustomerCustomsProfileError,
} from './customer.errors';
import { CustomerCustomsProfilesService } from './customer-customs-profiles.service';

function buildCustomsProfileRecord(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-07-01T00:00:00.000Z');

  return {
    id: '6f75b54b-92c4-4975-a7bf-91eec92a6121',
    customerId: '5a79a84d-9bd9-4c63-8b1b-c3728bba6294',
    documentType: 'CEDULA',
    documentNumber: '00112345678',
    ruaStatus: 'UNKNOWN',
    verificationSource: null,
    lastCheckedAt: null,
    verifiedAt: null,
    externalReference: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('CustomerCustomsProfilesService', () => {
  const customerCustomsProfilesRepository = {
    findByCustomerId: jest.fn(),
    upsertIdentity: jest.fn(),
    updateVerification: jest.fn(),
  };
  const service = new CustomerCustomsProfilesService(
    customerCustomsProfilesRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes CEDULA', async () => {
    customerCustomsProfilesRepository.upsertIdentity.mockResolvedValueOnce(
      buildCustomsProfileRecord(),
    );

    await service.upsertIdentity(
      'fbd54afb-62e8-4f5e-bfa9-293ee5d4dcf7',
      '5a79a84d-9bd9-4c63-8b1b-c3728bba6294',
      {
        documentType: 'CEDULA',
        documentNumber: '001-1234567-8',
      },
    );

    expect(
      customerCustomsProfilesRepository.upsertIdentity,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'fbd54afb-62e8-4f5e-bfa9-293ee5d4dcf7',
        customerId: '5a79a84d-9bd9-4c63-8b1b-c3728bba6294',
        documentType: 'CEDULA',
        documentNumber: '00112345678',
        ruaStatus: 'UNKNOWN',
        verificationSource: null,
        lastCheckedAt: null,
        verifiedAt: null,
        externalReference: null,
      }),
    );
  });

  it('normalizes RNC', async () => {
    customerCustomsProfilesRepository.upsertIdentity.mockResolvedValueOnce(
      buildCustomsProfileRecord({
        documentType: 'RNC',
        documentNumber: '101850043',
      }),
    );

    await service.upsertIdentity(
      'fbd54afb-62e8-4f5e-bfa9-293ee5d4dcf7',
      '5a79a84d-9bd9-4c63-8b1b-c3728bba6294',
      {
        documentType: 'RNC',
        documentNumber: '1-01-85004-3',
      },
    );

    expect(
      customerCustomsProfilesRepository.upsertIdentity,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: 'RNC',
        documentNumber: '101850043',
      }),
    );
  });

  it('normalizes PASSPORT', async () => {
    customerCustomsProfilesRepository.upsertIdentity.mockResolvedValueOnce(
      buildCustomsProfileRecord({
        documentType: 'PASSPORT',
        documentNumber: 'AB-12345',
      }),
    );

    await service.upsertIdentity(
      'fbd54afb-62e8-4f5e-bfa9-293ee5d4dcf7',
      '5a79a84d-9bd9-4c63-8b1b-c3728bba6294',
      {
        documentType: 'PASSPORT',
        documentNumber: '  ab-12345  ',
      },
    );

    expect(
      customerCustomsProfilesRepository.upsertIdentity,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: 'PASSPORT',
        documentNumber: 'AB-12345',
      }),
    );
  });

  it('rejects invalid document formats', async () => {
    await expect(
      service.upsertIdentity(
        'fbd54afb-62e8-4f5e-bfa9-293ee5d4dcf7',
        '5a79a84d-9bd9-4c63-8b1b-c3728bba6294',
        {
          documentType: 'CEDULA',
          documentNumber: '12345',
        },
      ),
    ).rejects.toBeInstanceOf(InvalidCustomerCustomsProfileError);

    await expect(
      service.upsertIdentity(
        'fbd54afb-62e8-4f5e-bfa9-293ee5d4dcf7',
        '5a79a84d-9bd9-4c63-8b1b-c3728bba6294',
        {
          documentType: 'PASSPORT',
          documentNumber: 'AB 123',
        },
      ),
    ).rejects.toBeInstanceOf(InvalidCustomerCustomsProfileError);
  });

  it('does not create ruaNumber and resets verification when the document changes', async () => {
    customerCustomsProfilesRepository.upsertIdentity.mockResolvedValueOnce(
      buildCustomsProfileRecord({
        documentType: 'PASSPORT',
        documentNumber: 'AB-12345',
        ruaStatus: 'UNKNOWN',
        verificationSource: null,
        lastCheckedAt: null,
        verifiedAt: null,
        externalReference: null,
        notes: 'Updated',
      }),
    );

    const profile = await service.upsertIdentity(
      'fbd54afb-62e8-4f5e-bfa9-293ee5d4dcf7',
      '5a79a84d-9bd9-4c63-8b1b-c3728bba6294',
      {
        documentType: 'PASSPORT',
        documentNumber: 'AB-12345',
        notes: '  Updated  ',
      },
    );

    expect('ruaNumber' in (profile as unknown as Record<string, unknown>)).toBe(
      false,
    );
    expect(
      customerCustomsProfilesRepository.upsertIdentity,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        ruaStatus: 'UNKNOWN',
        verificationSource: null,
        lastCheckedAt: null,
        verifiedAt: null,
        externalReference: null,
        notes: 'Updated',
      }),
    );
  });

  it('requires source and checkedAt for REGISTERED', async () => {
    await expect(
      service.updateVerification(
        'fbd54afb-62e8-4f5e-bfa9-293ee5d4dcf7',
        '5a79a84d-9bd9-4c63-8b1b-c3728bba6294',
        {
          status: 'REGISTERED',
        },
      ),
    ).rejects.toBeInstanceOf(InvalidCustomerCustomsProfileError);
  });

  it('requires source and checkedAt for NOT_REGISTERED', async () => {
    await expect(
      service.updateVerification(
        'fbd54afb-62e8-4f5e-bfa9-293ee5d4dcf7',
        '5a79a84d-9bd9-4c63-8b1b-c3728bba6294',
        {
          status: 'NOT_REGISTERED',
        },
      ),
    ).rejects.toBeInstanceOf(InvalidCustomerCustomsProfileError);
  });

  it('clears verification metadata for UNKNOWN', async () => {
    customerCustomsProfilesRepository.updateVerification.mockResolvedValueOnce(
      buildCustomsProfileRecord({
        ruaStatus: 'UNKNOWN',
        verificationSource: null,
        lastCheckedAt: null,
        verifiedAt: null,
        externalReference: null,
      }),
    );

    await service.updateVerification(
      'fbd54afb-62e8-4f5e-bfa9-293ee5d4dcf7',
      '5a79a84d-9bd9-4c63-8b1b-c3728bba6294',
      {
        status: 'UNKNOWN',
        source: 'MANUAL',
        checkedAt: '2026-07-01T12:00:00.000Z',
        externalReference: 'ABC',
      },
    );

    expect(
      customerCustomsProfilesRepository.updateVerification,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        ruaStatus: 'UNKNOWN',
        verificationSource: null,
        lastCheckedAt: null,
        verifiedAt: null,
        externalReference: null,
      }),
    );
  });

  it('sets verifiedAt equal to checkedAt for REGISTERED', async () => {
    const checkedAt = '2026-07-01T12:00:00.000Z';
    customerCustomsProfilesRepository.updateVerification.mockResolvedValueOnce(
      buildCustomsProfileRecord({
        ruaStatus: 'REGISTERED',
        verificationSource: 'MANUAL',
        lastCheckedAt: new Date(checkedAt),
        verifiedAt: new Date(checkedAt),
      }),
    );

    await service.updateVerification(
      'fbd54afb-62e8-4f5e-bfa9-293ee5d4dcf7',
      '5a79a84d-9bd9-4c63-8b1b-c3728bba6294',
      {
        status: 'REGISTERED',
        source: 'MANUAL',
        checkedAt,
      },
    );

    expect(
      customerCustomsProfilesRepository.updateVerification,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        ruaStatus: 'REGISTERED',
        verificationSource: 'MANUAL',
        lastCheckedAt: new Date(checkedAt),
        verifiedAt: new Date(checkedAt),
      }),
    );
  });

  it('translates duplicate identities into a domain conflict', async () => {
    customerCustomsProfilesRepository.upsertIdentity.mockRejectedValueOnce(
      new CustomerIdentityConflictError('CEDULA', '00112345678'),
    );

    await expect(
      service.upsertIdentity(
        'fbd54afb-62e8-4f5e-bfa9-293ee5d4dcf7',
        '5a79a84d-9bd9-4c63-8b1b-c3728bba6294',
        {
          documentType: 'CEDULA',
          documentNumber: '00112345678',
        },
      ),
    ).rejects.toBeInstanceOf(CustomerIdentityConflictError);
  });

  it('throws not found when the customs profile does not exist', async () => {
    customerCustomsProfilesRepository.findByCustomerId.mockResolvedValueOnce(
      null,
    );

    await expect(
      service.getByCustomerId(
        'fbd54afb-62e8-4f5e-bfa9-293ee5d4dcf7',
        '5a79a84d-9bd9-4c63-8b1b-c3728bba6294',
      ),
    ).rejects.toBeInstanceOf(CustomerCustomsProfileNotFoundError);
  });
});
