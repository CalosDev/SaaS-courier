import { Inject, Injectable } from '@nestjs/common';

import {
  PERMISSION_CATALOG,
  PERMISSION_CATALOG_CODES,
  type PermissionCode,
} from './permission.catalog';
import {
  InvalidRoleInputError,
  UnknownPermissionCodeError,
} from './rbac.errors';
import { RbacRepository } from './rbac.repository';
import type {
  AssignRoleToEmployeeInput,
  AssignRoleToEmployeeRecord,
  CreateRoleInput,
  CreateRoleRecord,
  HasPermissionInput,
  PermissionCatalogSyncResult,
  PermissionEvaluationInput,
  PermissionEvaluationRecord,
  RoleRecord,
} from './rbac.types';

const ROLE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,49}$/;

@Injectable()
export class RbacService {
  constructor(
    @Inject(RbacRepository)
    private readonly rbacRepository: RbacRepository,
  ) {}

  async syncPermissionCatalog(): Promise<PermissionCatalogSyncResult> {
    return this.rbacRepository.syncPermissionCatalog(PERMISSION_CATALOG);
  }

  async createRole(input: CreateRoleInput): Promise<RoleRecord> {
    const record = this.normalizeCreateRoleInput(input);

    return this.rbacRepository.createRoleWithPermissions(record);
  }

  async assignRoleToEmployee(input: AssignRoleToEmployeeInput): Promise<void> {
    const record = this.normalizeAssignmentInput(input);

    await this.rbacRepository.assignRoleToEmployee(record);
  }

  async hasPermission(input: HasPermissionInput): Promise<boolean> {
    const permissionCode = this.normalizePermissionCode(input.permissionCode);
    const effectivePermissionCodes = await this.getEffectivePermissionCodes({
      organizationId: input.organizationId,
      employeeId: input.employeeId,
    });

    return effectivePermissionCodes.includes(permissionCode);
  }

  async getEffectivePermissionCodes(
    input: PermissionEvaluationInput,
  ): Promise<string[]> {
    const record: PermissionEvaluationRecord = {
      organizationId: this.normalizeRequiredField(
        input.organizationId,
        'organizationId',
      ),
      employeeId: this.normalizeRequiredField(input.employeeId, 'employeeId'),
    };

    const permissionCodes =
      await this.rbacRepository.findEffectivePermissionCodes(record);

    return Array.from(new Set(permissionCodes)).sort((left, right) =>
      left.localeCompare(right),
    );
  }

  private normalizeCreateRoleInput(input: CreateRoleInput): CreateRoleRecord {
    const organizationId = this.normalizeRequiredField(
      input.organizationId,
      'organizationId',
    );
    const code = this.normalizeRoleCode(input.code);
    const name = this.normalizeRequiredField(input.name, 'name');
    const description = this.normalizeOptionalField(input.description);
    const permissionCodes = this.normalizePermissionCodes(
      input.permissionCodes,
    );

    return {
      organizationId,
      code,
      name,
      description,
      permissionCodes,
      isSystem: false,
    };
  }

  private normalizeAssignmentInput(
    input: AssignRoleToEmployeeInput,
  ): AssignRoleToEmployeeRecord {
    return {
      organizationId: this.normalizeRequiredField(
        input.organizationId,
        'organizationId',
      ),
      employeeId: this.normalizeRequiredField(input.employeeId, 'employeeId'),
      roleId: this.normalizeRequiredField(input.roleId, 'roleId'),
    };
  }

  private normalizeRoleCode(code: string): string {
    const normalizedCode = this.normalizeRequiredField(
      code,
      'code',
    ).toUpperCase();

    if (!ROLE_CODE_PATTERN.test(normalizedCode)) {
      throw new InvalidRoleInputError(
        'Invalid role input: code format is invalid',
      );
    }

    return normalizedCode;
  }

  private normalizePermissionCodes(permissionCodes?: string[]): string[] {
    if (!permissionCodes) {
      return [];
    }

    const normalizedCodes = permissionCodes.map((permissionCode) =>
      this.normalizePermissionCode(permissionCode),
    );

    return Array.from(new Set(normalizedCodes)).sort((left, right) =>
      left.localeCompare(right),
    );
  }

  private normalizePermissionCode(permissionCode: string): PermissionCode {
    const normalizedCode = this.normalizeRequiredField(
      permissionCode,
      'permissionCode',
    ).toLowerCase() as PermissionCode;

    if (!PERMISSION_CATALOG_CODES.has(normalizedCode)) {
      throw new UnknownPermissionCodeError(normalizedCode);
    }

    return normalizedCode;
  }

  private normalizeRequiredField(value: string, field: string): string {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      throw new InvalidRoleInputError(
        `Invalid role input: ${field} is required`,
      );
    }

    return normalizedValue;
  }

  private normalizeOptionalField(value?: string): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue || null;
  }
}
