import type { ActivationTokenSecret } from '../accounts/account.types';
import {
  EmployeeNotFoundError,
  EmployeeSelfManagementError,
  InvalidEmployeeInputError,
} from './employee.errors';
import { EmployeesService } from './employees.service';
import type {
  EmployeeDetailRecord,
  EmployeeInvitationRepositoryResult,
  EmployeeListResult,
  InviteEmployeeRecord,
  ListEmployeesRecord,
  ReplaceEmployeeFacilitiesRecord,
  ReplaceEmployeeRolesRecord,
  RevokeEmployeeSessionsRecord,
  UpdateEmployeeRecord,
} from './employee.types';

function buildEmployeeDetailRecord(
  overrides: Partial<EmployeeDetailRecord> = {},
): EmployeeDetailRecord {
  const now = new Date('2026-07-01T00:00:00.000Z');

  return {
    id: '54452682-e8ab-4489-ba20-0a2af721993f',
    employeeCode: 'EMP-001',
    firstName: 'Ada',
    lastName: 'Lovelace',
    phone: '809-555-0101',
    status: 'ACTIVE',
    user: {
      id: 'b9b8ec90-7b9d-47eb-94a1-93cab64c0adc',
      email: 'ada@courier.test',
      status: 'ACTIVE',
      emailVerifiedAt: now,
    },
    facilities: [
      {
        id: '99a8c15c-6511-4a89-9716-ac27bc63f34a',
        code: 'SDQ',
        name: 'Santo Domingo',
        type: 'BRANCH',
        isPrimary: true,
      },
    ],
    roles: [
      {
        id: '8a5ceb58-a667-4978-b637-b365d9af2694',
        code: 'OPS_MANAGER',
        name: 'Operations Manager',
        isActive: true,
      },
    ],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function buildInvitationRepositoryResult(
  overrides: Partial<EmployeeInvitationRepositoryResult> = {},
): EmployeeInvitationRepositoryResult {
  return {
    status: 'invited',
    employee: buildEmployeeDetailRecord(),
    activation: {
      expiresAt: new Date('2026-07-02T00:00:00.000Z'),
    },
    ...overrides,
  };
}

describe('EmployeesService', () => {
  const repository = {
    inviteEmployee: jest.fn<
      Promise<EmployeeInvitationRepositoryResult>,
      [InviteEmployeeRecord]
    >(),
    listEmployees: jest.fn<
      Promise<EmployeeListResult>,
      [ListEmployeesRecord]
    >(),
    findEmployeeById: jest.fn<
      Promise<EmployeeDetailRecord | null>,
      [string, string]
    >(),
    updateEmployee: jest.fn<
      Promise<EmployeeDetailRecord | null>,
      [UpdateEmployeeRecord]
    >(),
    replaceEmployeeFacilities: jest.fn<
      Promise<EmployeeDetailRecord | null>,
      [ReplaceEmployeeFacilitiesRecord]
    >(),
    replaceEmployeeRoles: jest.fn<
      Promise<EmployeeDetailRecord | null>,
      [ReplaceEmployeeRolesRecord]
    >(),
  };
  const activationTokenService = {
    createSecret: jest.fn<ActivationTokenSecret, []>(),
    hashToken: jest.fn<string, [string]>(),
  };
  const sessionsService = {
    revokeEmployeeSessions: jest.fn<
      Promise<number>,
      [RevokeEmployeeSessionsRecord]
    >(),
  };

  const service = new EmployeesService(
    repository,
    activationTokenService,
    sessionsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes invitation input and returns the raw activation token only once', async () => {
    activationTokenService.createSecret.mockReturnValueOnce({
      token: 'activation-secret',
      tokenHash:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    repository.inviteEmployee.mockResolvedValueOnce(
      buildInvitationRepositoryResult(),
    );

    const result = await service.inviteEmployee(
      'fdc4773e-bf8c-461f-a3be-807066378287',
      {
        email: '  Ada@Courier.Test  ',
        employeeCode: '  emp-001  ',
        firstName: '  Ada  ',
        lastName: '  Lovelace  ',
        phone: '   ',
        facilityIds: ['fac-2', 'fac-1', 'fac-2'],
        primaryFacilityId: 'fac-1',
        roleIds: ['role-2', 'role-1', 'role-2'],
      },
    );

    expect(repository.inviteEmployee).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'fdc4773e-bf8c-461f-a3be-807066378287',
        email: 'ada@courier.test',
        employeeCode: 'EMP-001',
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: null,
        facilityIds: ['fac-1', 'fac-2'],
        primaryFacilityId: 'fac-1',
        roleIds: ['role-1', 'role-2'],
        activationTokenHash:
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
    );
    expect(result.activation?.token).toBe('activation-secret');
  });

  it('rejects invitations when primaryFacilityId is not part of facilityIds', async () => {
    await expect(
      service.inviteEmployee('fdc4773e-bf8c-461f-a3be-807066378287', {
        email: 'ada@courier.test',
        firstName: 'Ada',
        lastName: 'Lovelace',
        facilityIds: ['fac-2'],
        primaryFacilityId: 'fac-1',
      }),
    ).rejects.toBeInstanceOf(InvalidEmployeeInputError);
  });

  it('trims the search query and applies default pagination when listing employees', async () => {
    repository.listEmployees.mockResolvedValueOnce({
      items: [buildEmployeeDetailRecord()],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
    });

    const result = await service.listEmployees(
      'fdc4773e-bf8c-461f-a3be-807066378287',
      {
        q: '  ada  ',
      },
    );

    expect(repository.listEmployees).toHaveBeenCalledWith({
      organizationId: 'fdc4773e-bf8c-461f-a3be-807066378287',
      page: 1,
      pageSize: 20,
      q: 'ada',
      status: undefined,
      facilityId: undefined,
      roleId: undefined,
    });
    expect(result.pagination.totalItems).toBe(1);
  });

  it('rejects invalid employee status transitions', async () => {
    repository.findEmployeeById.mockResolvedValueOnce(
      buildEmployeeDetailRecord({
        status: 'ACTIVE',
      }),
    );
    await expect(
      service.updateEmployee(
        'fdc4773e-bf8c-461f-a3be-807066378287',
        'actor-1',
        'employee-1',
        {
          status: 'PENDING',
        },
      ),
    ).rejects.toBeInstanceOf(InvalidEmployeeInputError);

    repository.findEmployeeById.mockResolvedValueOnce(
      buildEmployeeDetailRecord({
        status: 'TERMINATED',
      }),
    );
    await expect(
      service.updateEmployee(
        'fdc4773e-bf8c-461f-a3be-807066378287',
        'actor-1',
        'employee-1',
        {
          status: 'ACTIVE',
        },
      ),
    ).rejects.toBeInstanceOf(InvalidEmployeeInputError);
  });

  it('blocks self status changes, self facility replacement, and self role replacement', async () => {
    await expect(
      service.updateEmployee(
        'fdc4773e-bf8c-461f-a3be-807066378287',
        'employee-1',
        'employee-1',
        {
          status: 'SUSPENDED',
        },
      ),
    ).rejects.toBeInstanceOf(EmployeeSelfManagementError);

    await expect(
      service.replaceEmployeeFacilities(
        'fdc4773e-bf8c-461f-a3be-807066378287',
        'employee-1',
        'employee-1',
        {
          facilityIds: ['fac-1'],
          primaryFacilityId: 'fac-1',
        },
      ),
    ).rejects.toBeInstanceOf(EmployeeSelfManagementError);

    await expect(
      service.replaceEmployeeRoles(
        'fdc4773e-bf8c-461f-a3be-807066378287',
        'employee-1',
        'employee-1',
        {
          roleIds: ['role-1'],
        },
      ),
    ).rejects.toBeInstanceOf(EmployeeSelfManagementError);
  });

  it('revokes scoped employee sessions with ACCOUNT_CHANGED when suspending or terminating', async () => {
    repository.findEmployeeById.mockResolvedValueOnce(
      buildEmployeeDetailRecord({
        id: 'employee-2',
        status: 'ACTIVE',
      }),
    );
    repository.updateEmployee.mockResolvedValueOnce(
      buildEmployeeDetailRecord({
        status: 'SUSPENDED',
      }),
    );
    sessionsService.revokeEmployeeSessions.mockResolvedValueOnce(2);

    const result = await service.updateEmployee(
      'fdc4773e-bf8c-461f-a3be-807066378287',
      'actor-1',
      'employee-2',
      {
        status: 'SUSPENDED',
      },
    );

    expect(sessionsService.revokeEmployeeSessions).toHaveBeenCalledWith({
      organizationId: 'fdc4773e-bf8c-461f-a3be-807066378287',
      employeeId: 'employee-2',
      reason: 'ACCOUNT_CHANGED',
    });
    expect(result.status).toBe('SUSPENDED');
  });

  it('throws not found when updating or loading an employee that does not exist', async () => {
    repository.findEmployeeById.mockResolvedValueOnce(null);

    await expect(
      service.getEmployeeById(
        'fdc4773e-bf8c-461f-a3be-807066378287',
        'employee-missing',
      ),
    ).rejects.toBeInstanceOf(EmployeeNotFoundError);

    await expect(
      service.updateEmployee(
        'fdc4773e-bf8c-461f-a3be-807066378287',
        'actor-1',
        'employee-missing',
        {
          firstName: 'Ada',
        },
      ),
    ).rejects.toBeInstanceOf(EmployeeNotFoundError);
  });
});
