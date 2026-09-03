import type { Prisma } from '../generated/prisma/client';
import {
  LOCAL_ADMIN_EMPLOYEE_CODE,
  upsertLocalAdministratorEmployee,
} from './local-bootstrap.employee';

type EmployeeMock = {
  id: string;
  organizationId: string;
  userId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  status: 'ACTIVE';
  deletedAt: null;
};

describe('upsertLocalAdministratorEmployee', () => {
  const organizationId = '00000000-0000-0000-0000-000000000001';
  const userId = '00000000-0000-0000-0000-000000000002';

  function buildEmployee(overrides: Partial<EmployeeMock> = {}): EmployeeMock {
    return {
      id: '00000000-0000-0000-0000-000000000003',
      organizationId,
      userId,
      employeeCode: LOCAL_ADMIN_EMPLOYEE_CODE,
      firstName: 'Administrador',
      lastName: 'Local',
      status: 'ACTIVE',
      deletedAt: null,
      ...overrides,
    };
  }

  function buildTransactionClient(records: {
    byUser?: EmployeeMock | null;
    byCode?: EmployeeMock | null;
  }): Prisma.TransactionClient {
    const employee = {
      findUnique: jest
        .fn()
        .mockResolvedValueOnce(records.byUser ?? null)
        .mockResolvedValueOnce(records.byCode ?? null),
      update: jest.fn((args: { data: Partial<EmployeeMock> }) =>
        Promise.resolve(buildEmployee(args.data)),
      ),
      create: jest.fn((args: { data: Partial<EmployeeMock> }) =>
        Promise.resolve(buildEmployee(args.data)),
      ),
    };

    return { employee } as unknown as Prisma.TransactionClient;
  }

  it('creates the local administrator employee when it does not exist', async () => {
    const tx = buildTransactionClient({});

    await expect(
      upsertLocalAdministratorEmployee(tx, { organizationId, userId }),
    ).resolves.toMatchObject({
      organizationId,
      userId,
      employeeCode: LOCAL_ADMIN_EMPLOYEE_CODE,
      status: 'ACTIVE',
    });

    expect(tx.employee.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        userId,
        employeeCode: LOCAL_ADMIN_EMPLOYEE_CODE,
      }),
    });
  });

  it('reuses the employee code record when the configured admin user changes', async () => {
    const existing = buildEmployee({
      userId: '00000000-0000-0000-0000-000000000099',
    });
    const tx = buildTransactionClient({ byCode: existing });

    await upsertLocalAdministratorEmployee(tx, { organizationId, userId });

    expect(tx.employee.update).toHaveBeenCalledWith({
      where: {
        organizationId_id: {
          organizationId,
          id: existing.id,
        },
      },
      data: expect.objectContaining({
        userId,
        employeeCode: LOCAL_ADMIN_EMPLOYEE_CODE,
        deletedAt: null,
      }),
    });
  });

  it('rejects ambiguous local administrator records instead of guessing', async () => {
    const tx = buildTransactionClient({
      byUser: buildEmployee({ id: '00000000-0000-0000-0000-000000000011' }),
      byCode: buildEmployee({ id: '00000000-0000-0000-0000-000000000012' }),
    });

    await expect(
      upsertLocalAdministratorEmployee(tx, { organizationId, userId }),
    ).rejects.toThrow('conflicting ADMIN-LOCAL employee records');
  });
});
