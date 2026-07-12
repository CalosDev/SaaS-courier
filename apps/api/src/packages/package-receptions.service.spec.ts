import type { CommandContext } from '../request-context/request-context.types';
import { InvalidPackageInputError } from './package.errors';
import { PackageReceptionNotFoundError } from './package-reception.errors';
import { PackageReceptionsService } from './package-receptions.service';

const context: CommandContext = {
  organizationId: 'org-1',
  actorType: 'EMPLOYEE',
  actorUserId: 'user-1',
  actorEmployeeId: 'employee-1',
  source: 'HTTP',
  requestId: 'request-1',
  correlationId: 'correlation-1',
  ipAddress: null,
  userAgent: null,
};

const reception = {
  id: 'reception-1',
  organizationId: 'org-1',
  packageId: 'package-1',
  facility: {
    id: 'facility-1',
    code: 'MIA-01',
    name: 'Miami',
  },
  receivedBy: {
    id: 'employee-1',
    displayName: 'Ada Lovelace',
  },
  weight: '12.500',
  weightUnit: 'LB' as const,
  length: '10.00',
  width: '8.00',
  height: '6.00',
  dimensionUnit: 'IN' as const,
  pieceCount: 1,
  condition: 'SEALED' as const,
  receivedAt: new Date('2026-07-04T12:00:00.000Z'),
  createdAt: new Date('2026-07-04T12:00:00.000Z'),
};

describe('PackageReceptionsService', () => {
  const repository = {
    receive: jest.fn(),
    findByPackageId: jest.fn(),
  };
  const operationalHoldGuard = {
    assertNoActivePackageHolds: jest.fn(),
  };
  const service = new PackageReceptionsService(
    repository,
    operationalHoldGuard as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('receives a package using the authenticated employee and configured facility', async () => {
    repository.receive.mockResolvedValue(reception);

    await expect(
      service.receive(
        'org-1',
        'package-1',
        {
          facilityId: 'facility-1',
          weight: 12.5,
          length: 10,
          width: 8,
          height: 6,
          pieceCount: 1,
          condition: 'SEALED',
        },
        context,
      ),
    ).resolves.toEqual(reception);

    expect(repository.receive).toHaveBeenCalledWith(
      {
        organizationId: 'org-1',
        packageId: 'package-1',
        facilityId: 'facility-1',
        receivedByEmployeeId: 'employee-1',
        weight: '12.500',
        length: '10.00',
        width: '8.00',
        height: '6.00',
        pieceCount: 1,
        condition: 'SEALED',
      },
      context,
    );
    expect(
      operationalHoldGuard.assertNoActivePackageHolds,
    ).toHaveBeenCalledWith('org-1', 'package-1', {
      operation: 'package reception',
    });
  });

  it('does not receive a package while it has an active operational hold', async () => {
    operationalHoldGuard.assertNoActivePackageHolds.mockRejectedValueOnce(
      new Error('held package'),
    );

    await expect(
      service.receive(
        'org-1',
        'package-1',
        {
          facilityId: 'facility-1',
          weight: 12.5,
          length: 10,
          width: 8,
          height: 6,
          pieceCount: 1,
          condition: 'SEALED',
        },
        context,
      ),
    ).rejects.toThrow('held package');

    expect(repository.receive).not.toHaveBeenCalled();
  });

  it.each([
    ['weight', 0],
    ['length', 0],
    ['width', -1],
    ['height', Number.NaN],
  ] as const)('rejects invalid %s measurements', async (field, value) => {
    await expect(
      service.receive(
        'org-1',
        'package-1',
        {
          facilityId: 'facility-1',
          weight: 1,
          length: 1,
          width: 1,
          height: 1,
          pieceCount: 1,
          condition: 'SEALED',
          [field]: value,
        },
        context,
      ),
    ).rejects.toBeInstanceOf(InvalidPackageInputError);
  });

  it('rejects a reception without an authenticated employee actor', async () => {
    await expect(
      service.receive(
        'org-1',
        'package-1',
        {
          facilityId: 'facility-1',
          weight: 1,
          length: 1,
          width: 1,
          height: 1,
          pieceCount: 1,
          condition: 'SEALED',
        },
        { ...context, actorEmployeeId: null },
      ),
    ).rejects.toBeInstanceOf(InvalidPackageInputError);
  });

  it('returns the tenant-scoped package reception', async () => {
    repository.findByPackageId.mockResolvedValue(reception);

    await expect(service.get('org-1', 'package-1')).resolves.toEqual(reception);
    expect(repository.findByPackageId).toHaveBeenCalledWith(
      'org-1',
      'package-1',
    );
  });

  it('hides missing and cross-tenant receptions as not found', async () => {
    repository.findByPackageId.mockResolvedValue(null);

    await expect(
      service.get('org-1', 'foreign-package'),
    ).rejects.toBeInstanceOf(PackageReceptionNotFoundError);
  });
});
