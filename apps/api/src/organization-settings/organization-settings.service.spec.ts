import { InvalidOrganizationSettingsInputError } from './organization-settings.errors';
import { OrganizationSettingsService } from './organization-settings.service';

describe('OrganizationSettingsService', () => {
  const repository = {
    findCurrent: jest.fn(),
    updateCurrent: jest.fn(),
    getCapabilitiesSnapshot: jest.fn(),
  };
  const planCatalogService = {
    getPlan: jest.fn(),
  };
  const service = new OrganizationSettingsService(
    repository as never,
    planCatalogService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns current settings', async () => {
    const record = {
      organization: {
        id: 'org-1',
        planCode: 'PILOT',
        maxUsers: 5,
        maxFacilities: 2,
        countryCode: 'DO',
        currencyCode: 'DOP',
        timezone: 'America/Santo_Domingo',
      },
      settings: {
        locale: 'es-DO',
        dateFormat: 'DMY',
        weightUnit: 'LB',
        dimensionUnit: 'IN',
        customerCodeStrategy: 'AUTO_RANDOM',
        customerCodePrefix: 'C',
        customerCodeRandomLength: 8,
        customerCodeSequencePadding: 6,
        nextCustomerSequence: 1,
        onboardingCompletedAt: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        updatedAt: new Date('2026-07-01T00:00:00.000Z'),
      },
    };
    repository.findCurrent.mockResolvedValueOnce(record);

    await expect(
      service.getCurrent('67dca6cb-f4c0-4541-b233-4c0d4d26f02d'),
    ).resolves.toEqual(record);
  });

  it('updates organization and settings fields transactionally', async () => {
    repository.updateCurrent.mockResolvedValueOnce({
      organization: {
        id: 'org-1',
        planCode: 'PILOT',
        maxUsers: 5,
        maxFacilities: 2,
        countryCode: 'US',
        currencyCode: 'USD',
        timezone: 'America/New_York',
      },
      settings: {
        locale: 'en-US',
        dateFormat: 'MDY',
        weightUnit: 'KG',
        dimensionUnit: 'CM',
        customerCodeStrategy: 'AUTO_SEQUENTIAL',
        customerCodePrefix: 'CF-',
        customerCodeRandomLength: 8,
        customerCodeSequencePadding: 6,
        nextCustomerSequence: 1,
        onboardingCompletedAt: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        updatedAt: new Date('2026-07-01T00:00:00.000Z'),
      },
    });

    await service.updateCurrent('81bc17be-74b0-4b87-81d1-1383427c317f', {
      locale: ' en-US ',
      timezone: 'America/New_York',
      currencyCode: 'usd',
      countryCode: 'us',
      dateFormat: 'MDY',
      weightUnit: 'KG',
      dimensionUnit: 'CM',
      customerCodeStrategy: 'AUTO_SEQUENTIAL',
      customerCodePrefix: ' cf- ',
      customerCodeSequencePadding: 6,
    });

    expect(repository.updateCurrent).toHaveBeenCalledWith({
      organizationId: '81bc17be-74b0-4b87-81d1-1383427c317f',
      locale: 'en-US',
      timezone: 'America/New_York',
      currencyCode: 'USD',
      countryCode: 'US',
      dateFormat: 'MDY',
      weightUnit: 'KG',
      dimensionUnit: 'CM',
      customerCodeStrategy: 'AUTO_SEQUENTIAL',
      customerCodePrefix: 'CF-',
      customerCodeSequencePadding: 6,
    });
  });

  it('rejects empty patches', async () => {
    await expect(
      service.updateCurrent('5145c276-3cee-45a4-9835-7d4dd33a2305', {}),
    ).rejects.toBeInstanceOf(InvalidOrganizationSettingsInputError);
  });

  it('returns capabilities from plan catalog plus usage snapshot', async () => {
    repository.getCapabilitiesSnapshot.mockResolvedValueOnce({
      organization: {
        id: 'org-1',
        planCode: 'PILOT',
        maxUsers: 5,
        maxFacilities: 2,
      },
      usage: {
        users: 2,
        facilities: 1,
        customers: 3,
      },
    });
    planCatalogService.getPlan.mockReturnValueOnce({
      code: 'PILOT',
      modules: [
        'organizations',
        'facilities',
        'employees',
        'roles',
        'customers',
        'onboarding',
        'customer_imports',
      ],
    });

    await expect(
      service.getCapabilities('2253b054-91d0-43f7-a0ca-f654cca4fca8'),
    ).resolves.toEqual({
      planCode: 'PILOT',
      modules: [
        'organizations',
        'facilities',
        'employees',
        'roles',
        'customers',
        'onboarding',
        'customer_imports',
      ],
      limits: {
        maxUsers: 5,
        maxFacilities: 2,
      },
      usage: {
        users: 2,
        facilities: 1,
        customers: 3,
      },
    });
  });
});
