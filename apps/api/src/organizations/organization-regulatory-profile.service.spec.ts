import type { CommandContext } from '../request-context/request-context.types';
import {
  InvalidOrganizationRegulatoryProfileInputError,
  OrganizationRegulatoryProfileNotFoundError,
} from './organization-regulatory-profile.errors';
import { OrganizationRegulatoryProfileService } from './organization-regulatory-profile.service';

describe('OrganizationRegulatoryProfileService', () => {
  const organizationId = 'c6015f8d-f477-4ebe-9b0c-a4b43d925c10';
  const repository = {
    findCurrent: jest.fn(),
    updateCurrent: jest.fn(),
  };
  const service = new OrganizationRegulatoryProfileService(repository);
  const context: CommandContext = {
    organizationId,
    actorType: 'EMPLOYEE',
    actorUserId: 'f3f1b854-8d7e-4834-bef0-8b76701de682',
    actorEmployeeId: '2584c6a1-b316-48ce-9206-a5db7bcfba89',
    source: 'HTTP',
    requestId: 'f6ba3d09-b31f-46bf-a220-fd8a0d8d41ac',
    correlationId: '0d7cfdbf-e879-46fd-b1a4-2cc2c5e743a7',
    ipAddress: null,
    userAgent: 'jest',
  };

  beforeEach(() => jest.clearAllMocks());

  it('normalizes a tenant-scoped update before persistence', async () => {
    const persisted = { organizationId };
    repository.updateCurrent.mockResolvedValueOnce(persisted);

    await expect(
      service.updateCurrent(
        organizationId,
        {
          fiscalAddress: '  Santo Domingo  ',
          authorizedRepresentativeEmail: ' ADMIN@COURIER.TEST ',
          courierRegistrationStatus: 'IN_PROCESS',
          dgaOperatorCode: ' dga-001 ',
          electronicInvoicingStatus: 'NOT_ENROLLED',
        },
        context,
      ),
    ).resolves.toBe(persisted);

    expect(repository.updateCurrent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        fiscalAddress: 'Santo Domingo',
        authorizedRepresentativeEmail: 'admin@courier.test',
        courierRegistrationStatus: 'IN_PROCESS',
        dgaOperatorCode: 'DGA-001',
        electronicInvoicingStatus: 'NOT_ENROLLED',
        declaredAt: expect.any(Date),
      }),
      context,
    );
  });

  it.each([
    {},
    { authorizedRepresentativeEmail: 'invalid' },
    { dgaOperatorCode: 'invalid value' },
    { courierRegistrationStatus: 'VERIFIED' },
  ])('rejects invalid updates', async (input) => {
    await expect(
      service.updateCurrent(organizationId, input as never, context),
    ).rejects.toBeInstanceOf(InvalidOrganizationRegulatoryProfileInputError);
    expect(repository.updateCurrent).not.toHaveBeenCalled();
  });

  it('reports a missing tenant profile without creating one implicitly', async () => {
    repository.findCurrent.mockResolvedValueOnce(null);

    await expect(service.getCurrent(organizationId)).rejects.toBeInstanceOf(
      OrganizationRegulatoryProfileNotFoundError,
    );
  });
});
