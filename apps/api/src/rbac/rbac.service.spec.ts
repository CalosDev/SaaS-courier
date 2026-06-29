import { randomUUID } from 'node:crypto';

import {
  InvalidRoleInputError,
  UnknownPermissionCodeError,
} from './rbac.errors';
import type {
  AssignRoleToEmployeeRecord,
  CreateRoleRecord,
  PermissionCatalogSyncResult,
  PermissionEvaluationRecord,
  RoleRecord,
} from './rbac.types';
import { RbacService } from './rbac.service';

function buildRoleRecord(overrides: Partial<RoleRecord> = {}): RoleRecord {
  const now = new Date('2026-06-28T00:00:00.000Z');

  return {
    id: '89fd4a31-2207-4069-8c96-a3307455409d',
    organizationId: 'c0f62987-ebef-4e56-94a6-cb4b38d45c4b',
    code: 'OPS_MANAGER',
    name: 'Operations Manager',
    description: 'Operations access',
    isSystem: false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    permissionCodes: ['organizations.read', 'roles.read'],
    ...overrides,
  };
}

describe('RbacService', () => {
  const repository = {
    syncPermissionCatalog: jest.fn<
      Promise<PermissionCatalogSyncResult>,
      [readonly unknown[]]
    >(),
    createRoleWithPermissions: jest.fn<
      Promise<RoleRecord>,
      [CreateRoleRecord]
    >(),
    assignRoleToEmployee: jest.fn<
      Promise<void>,
      [AssignRoleToEmployeeRecord]
    >(),
    findEffectivePermissionCodes: jest.fn<
      Promise<string[]>,
      [PermissionEvaluationRecord]
    >(),
  };

  const service = new RbacService(repository);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('synchronizes the permission catalog through the repository', async () => {
    const syncResult: PermissionCatalogSyncResult = {
      inserted: 9,
      updated: 0,
      reactivated: 0,
      unchanged: 0,
      totalActiveCatalogPermissions: 9,
    };

    repository.syncPermissionCatalog.mockResolvedValueOnce(syncResult);

    await expect(service.syncPermissionCatalog()).resolves.toEqual(syncResult);
    expect(repository.syncPermissionCatalog).toHaveBeenCalledTimes(1);
  });

  it('normalizes the role code to uppercase before creating', async () => {
    repository.createRoleWithPermissions.mockResolvedValueOnce(
      buildRoleRecord(),
    );

    await service.createRole({
      organizationId: randomUUID(),
      code: '  ops_manager  ',
      name: 'Operations Manager',
    });

    expect(repository.createRoleWithPermissions).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'OPS_MANAGER',
      }),
    );
  });

  it('normalizes name and description before creating', async () => {
    repository.createRoleWithPermissions.mockResolvedValueOnce(
      buildRoleRecord(),
    );

    await service.createRole({
      organizationId: randomUUID(),
      code: 'OPS_MANAGER',
      name: '  Operations Manager  ',
      description: '  Operations access  ',
    });

    expect(repository.createRoleWithPermissions).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Operations Manager',
        description: 'Operations access',
      }),
    );
  });

  it('rejects an empty role code', async () => {
    await expect(
      service.createRole({
        organizationId: randomUUID(),
        code: '   ',
        name: 'Operations Manager',
      }),
    ).rejects.toBeInstanceOf(InvalidRoleInputError);
  });

  it('rejects an invalid role code format', async () => {
    await expect(
      service.createRole({
        organizationId: randomUUID(),
        code: 'OPS MANAGER',
        name: 'Operations Manager',
      }),
    ).rejects.toBeInstanceOf(InvalidRoleInputError);
  });

  it('rejects an empty role name', async () => {
    await expect(
      service.createRole({
        organizationId: randomUUID(),
        code: 'OPS_MANAGER',
        name: '   ',
      }),
    ).rejects.toBeInstanceOf(InvalidRoleInputError);
  });

  it('deduplicates and normalizes permission codes before creating', async () => {
    repository.createRoleWithPermissions.mockResolvedValueOnce(
      buildRoleRecord(),
    );

    await service.createRole({
      organizationId: randomUUID(),
      code: 'OPS_MANAGER',
      name: 'Operations Manager',
      permissionCodes: [
        '  ROLES.READ  ',
        'roles.read',
        ' organizations.read ',
        'ORGANIZATIONS.READ',
      ],
    });

    expect(repository.createRoleWithPermissions).toHaveBeenCalledWith(
      expect.objectContaining({
        permissionCodes: ['organizations.read', 'roles.read'],
      }),
    );
  });

  it('rejects unknown permission codes', async () => {
    await expect(
      service.createRole({
        organizationId: randomUUID(),
        code: 'OPS_MANAGER',
        name: 'Operations Manager',
        permissionCodes: ['roles.read', 'unknown.permission'],
      }),
    ).rejects.toBeInstanceOf(UnknownPermissionCodeError);
  });

  it('creates a role without permissions', async () => {
    const role = buildRoleRecord({ permissionCodes: [] });
    repository.createRoleWithPermissions.mockResolvedValueOnce(role);

    await expect(
      service.createRole({
        organizationId: role.organizationId,
        code: role.code,
        name: role.name,
      }),
    ).resolves.toEqual(role);

    expect(repository.createRoleWithPermissions).toHaveBeenCalledWith(
      expect.objectContaining({
        permissionCodes: [],
      }),
    );
  });

  it('creates a role with permissions', async () => {
    const role = buildRoleRecord();
    repository.createRoleWithPermissions.mockResolvedValueOnce(role);

    await expect(
      service.createRole({
        organizationId: role.organizationId,
        code: 'ops_manager',
        name: role.name,
        permissionCodes: role.permissionCodes,
      }),
    ).resolves.toEqual(role);
  });

  it('assigns a role to an employee', async () => {
    const organizationId = randomUUID();
    const employeeId = randomUUID();
    const roleId = randomUUID();

    await service.assignRoleToEmployee({
      organizationId,
      employeeId,
      roleId,
    });

    expect(repository.assignRoleToEmployee).toHaveBeenCalledWith({
      organizationId,
      employeeId,
      roleId,
    });
  });

  it('hasPermission returns true when the permission is effective', async () => {
    repository.findEffectivePermissionCodes.mockResolvedValueOnce([
      'organizations.read',
      'roles.read',
    ]);

    await expect(
      service.hasPermission({
        organizationId: randomUUID(),
        employeeId: randomUUID(),
        permissionCode: '  ROLES.READ  ',
      }),
    ).resolves.toBe(true);
  });

  it('hasPermission returns false when the permission is not effective', async () => {
    repository.findEffectivePermissionCodes.mockResolvedValueOnce([
      'organizations.read',
    ]);

    await expect(
      service.hasPermission({
        organizationId: randomUUID(),
        employeeId: randomUUID(),
        permissionCode: 'roles.read',
      }),
    ).resolves.toBe(false);
  });

  it('getEffectivePermissionCodes returns unique sorted codes', async () => {
    repository.findEffectivePermissionCodes.mockResolvedValueOnce([
      'roles.read',
      'organizations.read',
      'roles.read',
    ]);

    await expect(
      service.getEffectivePermissionCodes({
        organizationId: randomUUID(),
        employeeId: randomUUID(),
      }),
    ).resolves.toEqual(['organizations.read', 'roles.read']);
  });
});
