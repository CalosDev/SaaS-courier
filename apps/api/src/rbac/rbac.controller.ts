import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { CurrentSession } from '../auth/http/current-session.decorator';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';
import type { SessionContext } from '../sessions/session.types';
import { CreateRoleDto } from './dto/create-role.dto';
import { ListRolesDto } from './dto/list-roles.dto';
import { ReplaceRolePermissionsDto } from './dto/replace-role-permissions.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RequirePermissions } from './http/require-permissions.decorator';
import { RbacService } from './rbac.service';
import type {
  PermissionListItem,
  RoleDetailRecord,
  RoleListResult,
  RoleRecord,
} from './rbac.types';

@Controller()
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  @RequirePermissions('roles.read')
  async listRoles(
    @CurrentSession() session: SessionContext,
    @Query() query: ListRolesDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const result = await this.rbacService.listRoles({
      organizationId: session.organizationId,
      ...query,
    });

    return this.serializeRoleList(result);
  }

  @Post('roles')
  @RequirePermissions('roles.manage')
  @HttpCode(201)
  async createRole(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Body() body: CreateRoleDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const role = await this.rbacService.createRole({
      organizationId: session.organizationId,
      context,
      ...body,
    });

    return this.serializeRole(role);
  }

  @Get('roles/:roleId')
  @RequirePermissions('roles.read')
  async getRoleById(
    @CurrentSession() session: SessionContext,
    @Param('roleId', new ParseUUIDPipe({ version: '4' })) roleId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const role = await this.rbacService.getRoleById(
      session.organizationId,
      roleId,
    );

    return this.serializeRoleDetail(role);
  }

  @Patch('roles/:roleId')
  @RequirePermissions('roles.manage')
  async updateRole(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Param('roleId', new ParseUUIDPipe({ version: '4' })) roleId: string,
    @Body() body: UpdateRoleDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const role = await this.rbacService.updateRole({
      organizationId: session.organizationId,
      roleId,
      context,
      ...body,
    });

    return this.serializeRoleDetail(role);
  }

  @Put('roles/:roleId/permissions')
  @RequirePermissions('roles.manage')
  async replaceRolePermissions(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Param('roleId', new ParseUUIDPipe({ version: '4' })) roleId: string,
    @Body() body: ReplaceRolePermissionsDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const role = await this.rbacService.replaceRolePermissions({
      organizationId: session.organizationId,
      roleId,
      permissionCodes: body.permissionCodes,
      context,
    });

    return this.serializeRoleDetail(role);
  }

  @Get('permissions')
  @RequirePermissions('permissions.read')
  async listPermissions(@Res({ passthrough: true }) response: Response) {
    this.setNoStore(response);

    const permissions = await this.rbacService.listActivePermissions();

    return permissions.map((permission) =>
      this.serializePermission(permission),
    );
  }

  private setNoStore(response: Response): void {
    response.setHeader('Cache-Control', 'no-store');
  }

  private serializeRoleList(result: RoleListResult) {
    return {
      items: result.items.map((role) => this.serializeRole(role)),
      pagination: result.pagination,
    };
  }

  private serializeRole(role: RoleRecord) {
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      permissionCodes: role.permissionCodes,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  }

  private serializeRoleDetail(role: RoleDetailRecord) {
    return {
      ...this.serializeRole(role),
      assignedEmployeeCount: role.assignedEmployeeCount,
    };
  }

  private serializePermission(permission: PermissionListItem) {
    return {
      code: permission.code,
      name: permission.name,
      description: permission.description,
    };
  }
}
