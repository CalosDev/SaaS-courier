import { Inject, Injectable } from '@nestjs/common';

import {
  PERMISSION_CATALOG,
  PERMISSION_CATALOG_CODES,
  type PermissionCode,
} from './permission.catalog';
import {
  InvalidRoleInputError,
  RoleNotFoundError,
  UnknownPermissionCodeError,
} from './rbac.errors';
import { RbacRepository } from './rbac.repository';
import type {
  AssignRoleToEmployeeInput,
  AssignRoleToEmployeeRecord,
  CreateRoleInput,
  CreateRoleRecord,
  HasPermissionInput,
  ListRolesInput,
  PermissionListItem,
  PermissionCatalogSyncResult,
  PermissionEvaluationInput,
  PermissionEvaluationRecord,
  ReplaceRolePermissionsInput,
  ReplaceRolePermissionsRecord,
  RoleDetailRecord,
  RoleListResult,
  RoleRecord,
  UpdateRoleInput,
  UpdateRoleRecord,
} from './rbac.types';

const ROLE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,49}$/;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

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

  async listRoles(input: ListRolesInput): Promise<RoleListResult> {
    return this.rbacRepository.listRoles(this.normalizeListRolesInput(input));
  }

  async getRoleById(
    organizationId: string,
    roleId: string,
  ): Promise<RoleDetailRecord> {
    const role = await this.rbacRepository.findRoleById(
      this.normalizeRequiredField(organizationId, 'organizationId'),
      this.normalizeRequiredField(roleId, 'roleId'),
    );

    if (!role) {
      throw new RoleNotFoundError(roleId);
    }

    return role;
  }

  async updateRole(input: UpdateRoleInput): Promise<RoleDetailRecord> {
    const role = await this.rbacRepository.updateRole(
      this.normalizeUpdateRoleInput(input),
    );

    if (!role) {
      throw new RoleNotFoundError(input.roleId);
    }

    return role;
  }

  async replaceRolePermissions(
    input: ReplaceRolePermissionsInput,
  ): Promise<RoleDetailRecord> {
    const role = await this.rbacRepository.replaceRolePermissions(
      this.normalizeReplaceRolePermissionsInput(input),
    );

    if (!role) {
      throw new RoleNotFoundError(input.roleId);
    }

    return role;
  }

  async listActivePermissions(): Promise<PermissionListItem[]> {
    return this.rbacRepository.listActivePermissions();
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

  private normalizeListRolesInput(input: ListRolesInput) {
    const page = input.page ?? DEFAULT_PAGE;
    const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;

    if (!Number.isInteger(page) || page < 1) {
      throw new InvalidRoleInputError(
        'Invalid role input: page must be a positive integer',
      );
    }

    if (
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > MAX_PAGE_SIZE
    ) {
      throw new InvalidRoleInputError(
        'Invalid role input: pageSize is out of range',
      );
    }

    return {
      organizationId: this.normalizeRequiredField(
        input.organizationId,
        'organizationId',
      ),
      page,
      pageSize,
      q: this.normalizeOptionalField(input.q) ?? undefined,
      isActive:
        typeof input.isActive === 'boolean' ? input.isActive : undefined,
    };
  }

  private normalizeUpdateRoleInput(input: UpdateRoleInput): UpdateRoleRecord {
    const record: UpdateRoleRecord = {
      organizationId: this.normalizeRequiredField(
        input.organizationId,
        'organizationId',
      ),
      roleId: this.normalizeRequiredField(input.roleId, 'roleId'),
    };

    if (input.code !== undefined) {
      record.code = this.normalizeRoleCode(input.code);
    }

    if (input.name !== undefined) {
      record.name = this.normalizeRequiredField(input.name, 'name');
    }

    if (input.description !== undefined) {
      record.description = this.normalizeOptionalField(input.description);
    }

    if (input.isActive !== undefined) {
      if (typeof input.isActive !== 'boolean') {
        throw new InvalidRoleInputError(
          'Invalid role input: isActive must be boolean',
        );
      }

      record.isActive = input.isActive;
    }

    if (Object.keys(record).length === 2) {
      throw new InvalidRoleInputError(
        'Invalid role input: at least one field is required',
      );
    }

    return record;
  }

  private normalizeReplaceRolePermissionsInput(
    input: ReplaceRolePermissionsInput,
  ): ReplaceRolePermissionsRecord {
    if (!Array.isArray(input.permissionCodes)) {
      throw new InvalidRoleInputError(
        'Invalid role input: permissionCodes must be an array',
      );
    }

    return {
      organizationId: this.normalizeRequiredField(
        input.organizationId,
        'organizationId',
      ),
      roleId: this.normalizeRequiredField(input.roleId, 'roleId'),
      permissionCodes: this.normalizePermissionCodes(input.permissionCodes),
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
