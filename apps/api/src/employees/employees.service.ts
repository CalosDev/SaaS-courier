import { Inject, Injectable } from '@nestjs/common';

import { ActivationTokenService } from '../accounts/activation-token.service';
import { SessionsService } from '../sessions/sessions.service';
import {
  EMPLOYEE_STATUS_VALUES,
  type EmployeeDetailRecord,
  type EmployeeInvitationResult,
  type EmployeeListResult,
  type EmployeeStatus,
  type InviteEmployeeInput,
  type InviteEmployeeRecord,
  type ListEmployeesInput,
  type ListEmployeesRecord,
  type ReplaceEmployeeFacilitiesInput,
  type ReplaceEmployeeFacilitiesRecord,
  type ReplaceEmployeeRolesInput,
  type ReplaceEmployeeRolesRecord,
  type UpdateEmployeeInput,
  type UpdateEmployeeRecord,
} from './employee.types';
import {
  EmployeeNotFoundError,
  EmployeeSelfManagementError,
  InvalidEmployeeInputError,
} from './employee.errors';
import { EmployeesRepository } from './employees.repository';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const ACTIVATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const ALLOWED_STATUS_TRANSITIONS: Record<EmployeeStatus, EmployeeStatus[]> = {
  PENDING: ['ACTIVE', 'SUSPENDED', 'TERMINATED'],
  ACTIVE: ['SUSPENDED', 'TERMINATED'],
  SUSPENDED: ['ACTIVE', 'TERMINATED'],
  TERMINATED: [],
};

@Injectable()
export class EmployeesService {
  constructor(
    @Inject(EmployeesRepository)
    private readonly repository: EmployeesRepository,
    @Inject(ActivationTokenService)
    private readonly activationTokenService: Pick<
      ActivationTokenService,
      'createSecret'
    >,
    @Inject(SessionsService)
    private readonly sessionsService: Pick<
      SessionsService,
      'revokeEmployeeSessions'
    >,
  ) {}

  async inviteEmployee(
    organizationId: string,
    input: InviteEmployeeInput,
  ): Promise<EmployeeInvitationResult> {
    const activationSecret = this.activationTokenService.createSecret();
    const expiresAt = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS);
    const record: InviteEmployeeRecord = {
      ...this.normalizeInviteInput(organizationId, input),
      activationTokenHash: activationSecret.tokenHash,
      activationTokenExpiresAt: expiresAt,
      invitedAt: new Date(),
    };

    const result = await this.repository.inviteEmployee(record);

    return {
      status: result.status,
      employee: result.employee,
      activation:
        result.status === 'invited' && result.activation
          ? {
              token: activationSecret.token,
              expiresAt: result.activation.expiresAt,
            }
          : null,
    };
  }

  async listEmployees(
    organizationId: string,
    input: ListEmployeesInput,
  ): Promise<EmployeeListResult> {
    return this.repository.listEmployees(
      this.normalizeListInput(organizationId, input),
    );
  }

  async getEmployeeById(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeDetailRecord> {
    const employee = await this.repository.findEmployeeById(
      this.normalizeRequiredString(organizationId, 'organizationId'),
      this.normalizeRequiredString(employeeId, 'employeeId'),
    );

    if (!employee) {
      throw new EmployeeNotFoundError(employeeId);
    }

    return employee;
  }

  async updateEmployee(
    organizationId: string,
    actorEmployeeId: string,
    employeeId: string,
    input: UpdateEmployeeInput,
  ): Promise<EmployeeDetailRecord> {
    const normalizedOrganizationId = this.normalizeRequiredString(
      organizationId,
      'organizationId',
    );
    const normalizedEmployeeId = this.normalizeRequiredString(
      employeeId,
      'employeeId',
    );
    const normalizedActorEmployeeId = this.normalizeRequiredString(
      actorEmployeeId,
      'actorEmployeeId',
    );

    if (
      normalizedActorEmployeeId === normalizedEmployeeId &&
      input.status !== undefined
    ) {
      throw new EmployeeSelfManagementError();
    }

    const currentEmployee = await this.repository.findEmployeeById(
      normalizedOrganizationId,
      normalizedEmployeeId,
    );

    if (!currentEmployee) {
      throw new EmployeeNotFoundError(normalizedEmployeeId);
    }

    const record = this.normalizeUpdateInput(
      normalizedOrganizationId,
      normalizedEmployeeId,
      currentEmployee.status,
      input,
    );
    const updatedEmployee = await this.repository.updateEmployee(record);

    if (!updatedEmployee) {
      throw new EmployeeNotFoundError(normalizedEmployeeId);
    }

    if (
      record.status !== undefined &&
      record.status !== currentEmployee.status &&
      (record.status === 'SUSPENDED' || record.status === 'TERMINATED')
    ) {
      await this.sessionsService.revokeEmployeeSessions({
        organizationId: normalizedOrganizationId,
        employeeId: normalizedEmployeeId,
        reason: 'ACCOUNT_CHANGED',
      });
    }

    return updatedEmployee;
  }

  async replaceEmployeeFacilities(
    organizationId: string,
    actorEmployeeId: string,
    employeeId: string,
    input: ReplaceEmployeeFacilitiesInput,
  ): Promise<EmployeeDetailRecord> {
    const normalizedOrganizationId = this.normalizeRequiredString(
      organizationId,
      'organizationId',
    );
    const normalizedEmployeeId = this.normalizeRequiredString(
      employeeId,
      'employeeId',
    );
    const normalizedActorEmployeeId = this.normalizeRequiredString(
      actorEmployeeId,
      'actorEmployeeId',
    );

    if (normalizedActorEmployeeId === normalizedEmployeeId) {
      throw new EmployeeSelfManagementError();
    }

    const employee = await this.repository.findEmployeeById(
      normalizedOrganizationId,
      normalizedEmployeeId,
    );

    if (!employee) {
      throw new EmployeeNotFoundError(normalizedEmployeeId);
    }

    if (employee.status === 'TERMINATED') {
      throw new InvalidEmployeeInputError(
        'Invalid employee input: terminated employees cannot be modified',
      );
    }

    const record: ReplaceEmployeeFacilitiesRecord = {
      organizationId: normalizedOrganizationId,
      employeeId: normalizedEmployeeId,
      ...this.normalizeFacilitiesInput(input),
    };
    const updatedEmployee =
      await this.repository.replaceEmployeeFacilities(record);

    if (!updatedEmployee) {
      throw new EmployeeNotFoundError(normalizedEmployeeId);
    }

    return updatedEmployee;
  }

  async replaceEmployeeRoles(
    organizationId: string,
    actorEmployeeId: string,
    employeeId: string,
    input: ReplaceEmployeeRolesInput,
  ): Promise<EmployeeDetailRecord> {
    const normalizedOrganizationId = this.normalizeRequiredString(
      organizationId,
      'organizationId',
    );
    const normalizedEmployeeId = this.normalizeRequiredString(
      employeeId,
      'employeeId',
    );
    const normalizedActorEmployeeId = this.normalizeRequiredString(
      actorEmployeeId,
      'actorEmployeeId',
    );

    if (normalizedActorEmployeeId === normalizedEmployeeId) {
      throw new EmployeeSelfManagementError();
    }

    const employee = await this.repository.findEmployeeById(
      normalizedOrganizationId,
      normalizedEmployeeId,
    );

    if (!employee) {
      throw new EmployeeNotFoundError(normalizedEmployeeId);
    }

    if (employee.status === 'TERMINATED') {
      throw new InvalidEmployeeInputError(
        'Invalid employee input: terminated employees cannot be modified',
      );
    }

    const record: ReplaceEmployeeRolesRecord = {
      organizationId: normalizedOrganizationId,
      employeeId: normalizedEmployeeId,
      roleIds: this.normalizeIdentifierList(input.roleIds, 'roleIds'),
    };
    const updatedEmployee = await this.repository.replaceEmployeeRoles(record);

    if (!updatedEmployee) {
      throw new EmployeeNotFoundError(normalizedEmployeeId);
    }

    return updatedEmployee;
  }

  async revokeEmployeeSessions(
    organizationId: string,
    employeeId: string,
  ): Promise<void> {
    const normalizedOrganizationId = this.normalizeRequiredString(
      organizationId,
      'organizationId',
    );
    const normalizedEmployeeId = this.normalizeRequiredString(
      employeeId,
      'employeeId',
    );
    const employee = await this.repository.findEmployeeById(
      normalizedOrganizationId,
      normalizedEmployeeId,
    );

    if (!employee) {
      throw new EmployeeNotFoundError(normalizedEmployeeId);
    }

    await this.sessionsService.revokeEmployeeSessions({
      organizationId: normalizedOrganizationId,
      employeeId: normalizedEmployeeId,
      reason: 'ADMIN_REVOKED',
    });
  }

  private normalizeInviteInput(
    organizationId: string,
    input: InviteEmployeeInput,
  ): Omit<
    InviteEmployeeRecord,
    'activationTokenHash' | 'activationTokenExpiresAt' | 'invitedAt'
  > {
    const facilityIds = this.normalizeIdentifierList(
      input.facilityIds,
      'facilityIds',
    );
    const primaryFacilityId = this.normalizeOptionalString(
      input.primaryFacilityId,
    );

    if (primaryFacilityId && !facilityIds.includes(primaryFacilityId)) {
      throw new InvalidEmployeeInputError(
        'Invalid employee input: primaryFacilityId must belong to facilityIds',
      );
    }

    return {
      organizationId: this.normalizeRequiredString(
        organizationId,
        'organizationId',
      ),
      email: this.normalizeEmail(input.email),
      employeeCode:
        this.normalizeOptionalString(input.employeeCode)?.toUpperCase() ?? null,
      firstName: this.normalizeRequiredString(input.firstName, 'firstName'),
      lastName: this.normalizeRequiredString(input.lastName, 'lastName'),
      phone: this.normalizeOptionalString(input.phone),
      facilityIds,
      primaryFacilityId,
      roleIds: this.normalizeIdentifierList(input.roleIds, 'roleIds'),
    };
  }

  private normalizeListInput(
    organizationId: string,
    input: ListEmployeesInput,
  ): ListEmployeesRecord {
    const page = input.page ?? DEFAULT_PAGE;
    const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;

    if (!Number.isInteger(page) || page < 1) {
      throw new InvalidEmployeeInputError(
        'Invalid employee input: page must be a positive integer',
      );
    }

    if (
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > MAX_PAGE_SIZE
    ) {
      throw new InvalidEmployeeInputError(
        'Invalid employee input: pageSize is out of range',
      );
    }

    return {
      organizationId: this.normalizeRequiredString(
        organizationId,
        'organizationId',
      ),
      page,
      pageSize,
      q: this.normalizeSearchQuery(input.q),
      status:
        input.status === undefined
          ? undefined
          : this.normalizeEmployeeStatus(input.status),
      facilityId: this.normalizeOptionalString(input.facilityId) ?? undefined,
      roleId: this.normalizeOptionalString(input.roleId) ?? undefined,
    };
  }

  private normalizeUpdateInput(
    organizationId: string,
    employeeId: string,
    currentStatus: EmployeeStatus,
    input: UpdateEmployeeInput,
  ): UpdateEmployeeRecord {
    const record: UpdateEmployeeRecord = {
      organizationId,
      employeeId,
    };

    if (input.employeeCode !== undefined) {
      record.employeeCode =
        this.normalizeOptionalString(input.employeeCode)?.toUpperCase() ?? null;
    }

    if (input.firstName !== undefined) {
      record.firstName = this.normalizeRequiredString(
        input.firstName,
        'firstName',
      );
    }

    if (input.lastName !== undefined) {
      record.lastName = this.normalizeRequiredString(
        input.lastName,
        'lastName',
      );
    }

    if (input.phone !== undefined) {
      record.phone = this.normalizeOptionalString(input.phone);
    }

    if (input.status !== undefined) {
      const nextStatus = this.normalizeEmployeeStatus(input.status);

      if (
        nextStatus !== currentStatus &&
        !ALLOWED_STATUS_TRANSITIONS[currentStatus].includes(nextStatus)
      ) {
        throw new InvalidEmployeeInputError(
          'Invalid employee input: status transition is not allowed',
        );
      }

      record.status = nextStatus;
    }

    if (Object.keys(record).length === 2) {
      throw new InvalidEmployeeInputError(
        'Invalid employee input: at least one field is required',
      );
    }

    return record;
  }

  private normalizeFacilitiesInput(
    input: ReplaceEmployeeFacilitiesInput,
  ): Pick<
    ReplaceEmployeeFacilitiesRecord,
    'facilityIds' | 'primaryFacilityId'
  > {
    const facilityIds = this.normalizeIdentifierList(
      input.facilityIds,
      'facilityIds',
    );
    const primaryFacilityId = this.normalizeOptionalString(
      input.primaryFacilityId,
    );

    if (primaryFacilityId && !facilityIds.includes(primaryFacilityId)) {
      throw new InvalidEmployeeInputError(
        'Invalid employee input: primaryFacilityId must belong to facilityIds',
      );
    }

    return {
      facilityIds,
      primaryFacilityId,
    };
  }

  private normalizeEmail(email: string): string {
    return this.normalizeRequiredString(email, 'email').toLowerCase();
  }

  private normalizeEmployeeStatus(status: string): EmployeeStatus {
    if ((EMPLOYEE_STATUS_VALUES as readonly string[]).includes(status)) {
      return status as EmployeeStatus;
    }

    throw new InvalidEmployeeInputError(
      'Invalid employee input: status is invalid',
    );
  }

  private normalizeIdentifierList(
    values: string[] | undefined,
    field: string,
  ): string[] {
    if (values === undefined) {
      return [];
    }

    if (!Array.isArray(values)) {
      throw new InvalidEmployeeInputError(
        `Invalid employee input: ${field} must be an array`,
      );
    }

    const normalizedValues = values.map((value) =>
      this.normalizeRequiredString(value, field),
    );

    return Array.from(new Set(normalizedValues)).sort((left, right) =>
      left.localeCompare(right),
    );
  }

  private normalizeRequiredString(value: string, field: string): string {
    if (typeof value !== 'string') {
      throw new InvalidEmployeeInputError(
        `Invalid employee input: ${field} is required`,
      );
    }

    const normalizedValue = value.trim();

    if (!normalizedValue) {
      throw new InvalidEmployeeInputError(
        `Invalid employee input: ${field} is required`,
      );
    }

    return normalizedValue;
  }

  private normalizeOptionalString(value?: string): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private normalizeSearchQuery(value?: string): string | undefined {
    return this.normalizeOptionalString(value) ?? undefined;
  }
}
