import { randomUUID } from 'node:crypto';

import {
  InvalidRoleInputError,
  UnknownPermissionCodeError,
} from './rbac.errors';
import type {
  AssignRoleToEmployeeRecord,
  CreateRoleRecord,
  ListRolesRecord,
  PermissionListItem,
  PermissionCatalogSyncResult,
  PermissionEvaluationRecord,
  RoleRecord,
  RoleDetailRecord,
  ReplaceRolePermissionsRecord,
  UpdateRoleRecord,
} from './rbac.types';
import { RbacService } from './rbac.service';
import type { CommandContext } from '../request-context/request-context.types';

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
  const commandContext: CommandContext = {
    organizationId: 'c0f62987-ebef-4e56-94a6-cb4b38d45c4b',
    actorType: 'EMPLOYEE',
    actorUserId: '12c254df-1cc8-4413-b33d-cc791c49cb34',
    actorEmployeeId: '3f2e9bb8-68f8-48ed-a06f-265a51a66008',
    source: 'HTTP',
    requestId: '36ef98cc-ef79-42ce-894a-cfe04f866678',
    correlationId: '967b142d-fe90-473f-ae43-e4f2b13675dc',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };
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
    listRoles: jest.fn<
      Promise<{
        items: RoleRecord[];
        pagination: {
          page: number;
          pageSize: number;
          totalItems: number;
          totalPages: number;
        };
      }>,
      [ListRolesRecord]
    >(),
    findRoleById: jest.fn<Promise<RoleDetailRecord | null>, [string, string]>(),
    updateRole: jest.fn<Promise<RoleDetailRecord | null>, [UpdateRoleRecord]>(),
    replaceRolePermissions: jest.fn<
      Promise<RoleDetailRecord | null>,
      [ReplaceRolePermissionsRecord]
    >(),
    listActivePermissions: jest.fn<Promise<PermissionListItem[]>, []>(),
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

  it('lists roles with normalized query and default pagination', async () => {
    repository.listRoles.mockResolvedValueOnce({
      items: [buildRoleRecord()],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
    });

    const result = await service.listRoles({
      organizationId: randomUUID(),
      q: '  ops  ',
    });

    expect(repository.listRoles).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 20,
        q: 'ops',
      }),
    );
    expect(result.pagination.totalItems).toBe(1);
  });

  it('normalizes role code, name, and permission codes when updating role metadata and permissions', async () => {
    repository.updateRole.mockResolvedValueOnce(
      buildRoleRecord({
        code: 'OPS_SUPPORT',
        name: 'Ops Support',
      }) as unknown as RoleDetailRecord,
    );
    repository.replaceRolePermissions.mockResolvedValueOnce(
      buildRoleRecord({
        permissionCodes: ['employees.read', 'roles.read'],
      }) as unknown as RoleDetailRecord,
    );

    await service.updateRole({
      organizationId: randomUUID(),
      roleId: randomUUID(),
      code: '  ops_support  ',
      name: '  Ops Support  ',
      description: '  Updated  ',
      isActive: true,
    });

    await service.replaceRolePermissions({
      organizationId: randomUUID(),
      roleId: randomUUID(),
      permissionCodes: [' ROLES.READ ', 'employees.read', 'roles.read'],
    });

    expect(repository.updateRole).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'OPS_SUPPORT',
        name: 'Ops Support',
        description: 'Updated',
      }),
    );
    expect(repository.replaceRolePermissions).toHaveBeenCalledWith(
      expect.objectContaining({
        permissionCodes: ['employees.read', 'roles.read'],
      }),
    );
  });

  it('preserves the authenticated command context for audited role mutations', async () => {
    repository.createRoleWithPermissions.mockResolvedValueOnce(
      buildRoleRecord(),
    );
    repository.updateRole.mockResolvedValueOnce(
      buildRoleRecord() as RoleDetailRecord,
    );
    repository.replaceRolePermissions.mockResolvedValueOnce(
      buildRoleRecord() as RoleDetailRecord,
    );

    await service.createRole({
      organizationId: commandContext.organizationId,
      code: 'OPS_MANAGER',
      name: 'Operations Manager',
      context: commandContext,
    });
    await service.updateRole({
      organizationId: commandContext.organizationId,
      roleId: randomUUID(),
      name: 'Operations Lead',
      context: commandContext,
    });
    await service.replaceRolePermissions({
      organizationId: commandContext.organizationId,
      roleId: randomUUID(),
      permissionCodes: ['roles.read'],
      context: commandContext,
    });

    expect(repository.createRoleWithPermissions).toHaveBeenCalledWith(
      expect.objectContaining({ context: commandContext }),
    );
    expect(repository.updateRole).toHaveBeenCalledWith(
      expect.objectContaining({ context: commandContext }),
    );
    expect(repository.replaceRolePermissions).toHaveBeenCalledWith(
      expect.objectContaining({ context: commandContext }),
    );
  });

  it('lists only active permissions through the repository', async () => {
    repository.listActivePermissions.mockResolvedValueOnce([
      {
        code: 'employees.read',
        name: 'Employees read',
        description: 'Read employees',
      },
    ]);

    await expect(service.listActivePermissions()).resolves.toEqual([
      {
        code: 'employees.read',
        name: 'Employees read',
        description: 'Read employees',
      },
    ]);
  });
});
