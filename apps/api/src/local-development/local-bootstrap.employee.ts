import type { Employee, Prisma } from '../generated/prisma/client';

export const LOCAL_ADMIN_EMPLOYEE_CODE = 'ADMIN-LOCAL';

type UpsertLocalAdministratorEmployeeInput = {
  organizationId: string;
  userId: string;
};

export async function upsertLocalAdministratorEmployee(
  tx: Prisma.TransactionClient,
  input: UpsertLocalAdministratorEmployeeInput,
): Promise<Employee> {
  const employeeByUser = await tx.employee.findUnique({
    where: {
      organizationId_userId: {
        organizationId: input.organizationId,
        userId: input.userId,
      },
    },
  });

  const employeeByCode = await tx.employee.findUnique({
    where: {
      organizationId_employeeCode: {
        organizationId: input.organizationId,
        employeeCode: LOCAL_ADMIN_EMPLOYEE_CODE,
      },
    },
  });

  if (
    employeeByUser &&
    employeeByCode &&
    employeeByUser.id !== employeeByCode.id
  ) {
    throw new Error(
      'Local bootstrap found conflicting ADMIN-LOCAL employee records for this organization',
    );
  }

  const existingEmployee = employeeByCode ?? employeeByUser;
  const data = {
    userId: input.userId,
    employeeCode: LOCAL_ADMIN_EMPLOYEE_CODE,
    firstName: 'Administrador',
    lastName: 'Local',
    status: 'ACTIVE' as const,
    deletedAt: null,
  };

  if (existingEmployee) {
    return tx.employee.update({
      where: {
        organizationId_id: {
          organizationId: input.organizationId,
          id: existingEmployee.id,
        },
      },
      data,
    });
  }

  return tx.employee.create({
    data: {
      organizationId: input.organizationId,
      ...data,
    },
  });
}
