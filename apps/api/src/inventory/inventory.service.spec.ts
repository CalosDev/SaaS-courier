import { PackageNotFoundError } from '../packages/package.errors';
import type { PackageRecord } from '../packages/package.types';
import type { PackagesService } from '../packages/packages.service';
import type { CommandContext } from '../request-context/request-context.types';
import { InvalidInventoryInputError } from './inventory.errors';
import { InventoryService } from './inventory.service';
import type {
  CreateWarehouseLocationRecord,
  InventoryMovementRecord,
  InventoryPackageListResult,
  InventoryPackageRecord,
  ListInventoryPackagesRecord,
  ListWarehouseLocationsRecord,
  MoveInventoryPackageRecord,
  UpdateWarehouseLocationRecord,
  WarehouseLocationListResult,
  WarehouseLocationRecord,
} from './inventory.types';

function buildContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    organizationId: 'c6015f8d-f477-4ebe-9b0c-a4b43d925c10',
    actorType: 'EMPLOYEE',
    actorUserId: 'f3f1b854-8d7e-4834-bef0-8b76701de682',
    actorEmployeeId: '2584c6a1-b316-48ce-9206-a5db7bcfba89',
    source: 'HTTP',
    requestId: 'f6ba3d09-b31f-46bf-a220-fd8a0d8d41ac',
    correlationId: '0d7cfdbf-e879-46fd-b1a4-2cc2c5e743a7',
    ipAddress: null,
    userAgent: 'jest',
    ...overrides,
  };
}

function buildLocation(
  overrides: Partial<WarehouseLocationRecord> = {},
): WarehouseLocationRecord {
  const now = new Date('2026-07-07T00:00:00.000Z');

  return {
    id: '456caf58-d5df-4a44-8b33-0960a7a90790',
    organizationId: 'c6015f8d-f477-4ebe-9b0c-a4b43d925c10',
    facility: {
      id: '4798f81c-aa02-420c-a5bf-4ee56f9c149a',
      code: 'MIA-01',
      name: 'Miami Origin',
    },
    code: 'A-01',
    name: 'Rack A-01',
    type: 'SHELF',
    description: 'Primary shelf',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function buildInventoryPackage(
  overrides: Partial<InventoryPackageRecord> = {},
): InventoryPackageRecord {
  const now = new Date('2026-07-07T00:00:00.000Z');

  return {
    id: '3de797ca-6ea4-45de-8539-bd433700c342',
    internalTrackingNumber: 'PK7KMP4TX9RW3Q',
    externalTrackingNumber: '1Z-999-AA1-01-2345-6784',
    status: 'RECEIVED_AT_ORIGIN',
    customer: {
      id: 'efc1a032-3738-43bf-b1b0-aa74af57cbad',
      customerCode: 'C-0001',
      displayName: 'Ada Lovelace',
    },
    reception: {
      facility: {
        id: '4798f81c-aa02-420c-a5bf-4ee56f9c149a',
        code: 'MIA-01',
        name: 'Miami Origin',
      },
      receivedAt: now,
    },
    currentPosition: null,
    ...overrides,
  };
}

function buildPackageRecord(
  overrides: Partial<PackageRecord> = {},
): PackageRecord {
  const now = new Date('2026-07-07T00:00:00.000Z');

  return {
    id: '3de797ca-6ea4-45de-8539-bd433700c342',
    internalTrackingNumber: 'PK7KMP4TX9RW3Q',
    externalTrackingNumber: '1Z-999-AA1-01-2345-6784',
    status: 'RECEIVED_AT_ORIGIN',
    source: 'MANUAL',
    notes: null,
    cancellationReason: null,
    cancelledAt: null,
    customer: {
      id: 'efc1a032-3738-43bf-b1b0-aa74af57cbad',
      customerCode: 'C-0001',
      type: 'INDIVIDUAL',
      displayName: 'Ada Lovelace',
    },
    prealert: null,
    registeredBy: {
      id: '2584c6a1-b316-48ce-9206-a5db7bcfba89',
      displayName: 'Ada Lovelace',
    },
    cancelledBy: null,
    registeredAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function buildMovement(
  overrides: Partial<InventoryMovementRecord> = {},
): InventoryMovementRecord {
  const now = new Date('2026-07-07T00:00:00.000Z');

  return {
    id: 'a2d63552-cd3d-40ee-b8c4-cd6efc8b0853',
    packageId: '3de797ca-6ea4-45de-8539-bd433700c342',
    facility: {
      id: '4798f81c-aa02-420c-a5bf-4ee56f9c149a',
      code: 'MIA-01',
      name: 'Miami Origin',
    },
    movementType: 'PUTAWAY',
    fromLocation: null,
    toLocation: {
      id: '456caf58-d5df-4a44-8b33-0960a7a90790',
      code: 'A-01',
      name: 'Rack A-01',
      type: 'SHELF',
    },
    movedBy: {
      id: '2584c6a1-b316-48ce-9206-a5db7bcfba89',
      displayName: 'Ada Lovelace',
    },
    note: 'First placement',
    occurredAt: now,
    createdAt: now,
    ...overrides,
  };
}

describe('InventoryService', () => {
  const getByIdMock = jest.fn<Promise<PackageRecord>, [string, string]>();
  const repository = {
    listLocations: jest.fn<
      Promise<WarehouseLocationListResult>,
      [ListWarehouseLocationsRecord]
    >(),
    createLocation: jest.fn<
      Promise<WarehouseLocationRecord>,
      [CreateWarehouseLocationRecord, CommandContext]
    >(),
    updateLocation: jest.fn<
      Promise<WarehouseLocationRecord | null>,
      [UpdateWarehouseLocationRecord, CommandContext]
    >(),
    listPackages: jest.fn<
      Promise<InventoryPackageListResult>,
      [ListInventoryPackagesRecord]
    >(),
    movePackage: jest.fn<
      Promise<InventoryPackageRecord | null>,
      [MoveInventoryPackageRecord, CommandContext]
    >(),
    listPackageMovements: jest.fn<
      Promise<InventoryMovementRecord[]>,
      [string, string]
    >(),
  };

  const packagesService: Pick<PackagesService, 'getById'> = {
    getById: getByIdMock,
  };

  const service = new InventoryService(
    repository,
    packagesService as PackagesService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes location input and defaults isActive during creation', async () => {
    const location = buildLocation({
      code: 'A_01',
      name: 'Rack A 01',
      description: 'Near reception',
    });
    repository.createLocation.mockResolvedValueOnce(location);

    await expect(
      service.createLocation(
        ' c6015f8d-f477-4ebe-9b0c-a4b43d925c10 ',
        {
          facilityId: ' 4798f81c-aa02-420c-a5bf-4ee56f9c149a ',
          code: ' a_01 ',
          name: ' Rack A 01 ',
          type: 'SHELF',
          description: ' Near reception ',
        },
        buildContext(),
      ),
    ).resolves.toEqual(location);

    expect(repository.createLocation).toHaveBeenCalledWith(
      {
        organizationId: 'c6015f8d-f477-4ebe-9b0c-a4b43d925c10',
        facilityId: '4798f81c-aa02-420c-a5bf-4ee56f9c149a',
        code: 'A_01',
        name: 'Rack A 01',
        type: 'SHELF',
        description: 'Near reception',
        isActive: true,
      },
      buildContext(),
    );
  });

  it('rejects location updates without any mutable field', async () => {
    await expect(
      service.updateLocation(
        'c6015f8d-f477-4ebe-9b0c-a4b43d925c10',
        '456caf58-d5df-4a44-8b33-0960a7a90790',
        {},
        buildContext(),
      ),
    ).rejects.toBeInstanceOf(InvalidInventoryInputError);
  });

  it('normalizes inventory package filters and pagination when listing', async () => {
    const result: InventoryPackageListResult = {
      items: [buildInventoryPackage()],
      pagination: {
        page: 2,
        pageSize: 5,
        totalItems: 1,
        totalPages: 1,
      },
    };
    repository.listPackages.mockResolvedValueOnce(result);

    await expect(
      service.listPackages('c6015f8d-f477-4ebe-9b0c-a4b43d925c10', {
        page: 2,
        pageSize: 5,
        q: ' PK7K ',
        facilityId: ' 4798f81c-aa02-420c-a5bf-4ee56f9c149a ',
        locationId: ' 456caf58-d5df-4a44-8b33-0960a7a90790 ',
      }),
    ).resolves.toEqual(result);

    expect(repository.listPackages).toHaveBeenCalledWith({
      organizationId: 'c6015f8d-f477-4ebe-9b0c-a4b43d925c10',
      page: 2,
      pageSize: 5,
      q: 'PK7K',
      facilityId: '4798f81c-aa02-420c-a5bf-4ee56f9c149a',
      locationId: '456caf58-d5df-4a44-8b33-0960a7a90790',
    });
  });

  it('verifies the package exists before moving and normalizes the move payload', async () => {
    const movedPackage = buildInventoryPackage({
      currentPosition: {
        location: {
          id: '456caf58-d5df-4a44-8b33-0960a7a90790',
          code: 'A-01',
          name: 'Rack A-01',
          type: 'SHELF',
        },
        placedAt: new Date('2026-07-07T00:10:00.000Z'),
        updatedAt: new Date('2026-07-07T00:10:00.000Z'),
      },
    });
    getByIdMock.mockResolvedValueOnce(buildPackageRecord());
    repository.movePackage.mockResolvedValueOnce(movedPackage);

    await expect(
      service.movePackage(
        'c6015f8d-f477-4ebe-9b0c-a4b43d925c10',
        '3de797ca-6ea4-45de-8539-bd433700c342',
        {
          movementType: 'PUTAWAY',
          toLocationId: ' 456caf58-d5df-4a44-8b33-0960a7a90790 ',
          note: ' First placement ',
        },
        buildContext(),
      ),
    ).resolves.toEqual(movedPackage);

    expect(getByIdMock).toHaveBeenCalledWith(
      'c6015f8d-f477-4ebe-9b0c-a4b43d925c10',
      '3de797ca-6ea4-45de-8539-bd433700c342',
    );
    expect(repository.movePackage).toHaveBeenCalledWith(
      {
        organizationId: 'c6015f8d-f477-4ebe-9b0c-a4b43d925c10',
        packageId: '3de797ca-6ea4-45de-8539-bd433700c342',
        movedByEmployeeId: '2584c6a1-b316-48ce-9206-a5db7bcfba89',
        movementType: 'PUTAWAY',
        toLocationId: '456caf58-d5df-4a44-8b33-0960a7a90790',
        note: 'First placement',
      },
      buildContext(),
    );
  });

  it('throws package not found when the repository cannot reload a moved package', async () => {
    getByIdMock.mockResolvedValueOnce(buildPackageRecord());
    repository.movePackage.mockResolvedValueOnce(null);

    await expect(
      service.movePackage(
        'c6015f8d-f477-4ebe-9b0c-a4b43d925c10',
        '3de797ca-6ea4-45de-8539-bd433700c342',
        {
          movementType: 'REMOVE',
        },
        buildContext(),
      ),
    ).rejects.toBeInstanceOf(PackageNotFoundError);
  });

  it('lists movements only after confirming the package is visible in the tenant', async () => {
    const movements = [buildMovement()];
    getByIdMock.mockResolvedValueOnce(buildPackageRecord());
    repository.listPackageMovements.mockResolvedValueOnce(movements);

    await expect(
      service.listPackageMovements(
        'c6015f8d-f477-4ebe-9b0c-a4b43d925c10',
        '3de797ca-6ea4-45de-8539-bd433700c342',
      ),
    ).resolves.toEqual(movements);

    expect(repository.listPackageMovements).toHaveBeenCalledWith(
      'c6015f8d-f477-4ebe-9b0c-a4b43d925c10',
      '3de797ca-6ea4-45de-8539-bd433700c342',
    );
  });
});
