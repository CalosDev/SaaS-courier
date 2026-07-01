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
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import type { SessionContext } from '../sessions/session.types';
import { InviteEmployeeDto } from './dto/invite-employee.dto';
import { ListEmployeesDto } from './dto/list-employees.dto';
import { ReplaceEmployeeFacilitiesDto } from './dto/replace-employee-facilities.dto';
import { ReplaceEmployeeRolesDto } from './dto/replace-employee-roles.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';
import type {
  EmployeeDetailRecord,
  EmployeeInvitationResult,
  EmployeeListResult,
} from './employee.types';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequirePermissions('employees.read')
  async listEmployees(
    @CurrentSession() session: SessionContext,
    @Query() query: ListEmployeesDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const result = await this.employeesService.listEmployees(
      session.organizationId,
      query,
    );

    return this.serializeEmployeeList(result);
  }

  @Post('invitations')
  @RequirePermissions('employees.manage')
  @HttpCode(201)
  async inviteEmployee(
    @CurrentSession() session: SessionContext,
    @Body() body: InviteEmployeeDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const result = await this.employeesService.inviteEmployee(
      session.organizationId,
      body,
    );

    return this.serializeInvitationResult(result);
  }

  @Get(':employeeId')
  @RequirePermissions('employees.read')
  async getEmployeeById(
    @CurrentSession() session: SessionContext,
    @Param('employeeId', new ParseUUIDPipe({ version: '4' }))
    employeeId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const employee = await this.employeesService.getEmployeeById(
      session.organizationId,
      employeeId,
    );

    return this.serializeEmployee(employee);
  }

  @Patch(':employeeId')
  @RequirePermissions('employees.manage')
  async updateEmployee(
    @CurrentSession() session: SessionContext,
    @Param('employeeId', new ParseUUIDPipe({ version: '4' }))
    employeeId: string,
    @Body() body: UpdateEmployeeDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const employee = await this.employeesService.updateEmployee(
      session.organizationId,
      session.employeeId,
      employeeId,
      body,
    );

    return this.serializeEmployee(employee);
  }

  @Put(':employeeId/facilities')
  @RequirePermissions('employees.manage')
  async replaceEmployeeFacilities(
    @CurrentSession() session: SessionContext,
    @Param('employeeId', new ParseUUIDPipe({ version: '4' }))
    employeeId: string,
    @Body() body: ReplaceEmployeeFacilitiesDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const employee = await this.employeesService.replaceEmployeeFacilities(
      session.organizationId,
      session.employeeId,
      employeeId,
      body,
    );

    return this.serializeEmployee(employee);
  }

  @Put(':employeeId/roles')
  @RequirePermissions('employees.manage', 'roles.manage')
  async replaceEmployeeRoles(
    @CurrentSession() session: SessionContext,
    @Param('employeeId', new ParseUUIDPipe({ version: '4' }))
    employeeId: string,
    @Body() body: ReplaceEmployeeRolesDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const employee = await this.employeesService.replaceEmployeeRoles(
      session.organizationId,
      session.employeeId,
      employeeId,
      body,
    );

    return this.serializeEmployee(employee);
  }

  @Post(':employeeId/revoke-sessions')
  @RequirePermissions('employees.manage')
  @HttpCode(204)
  async revokeEmployeeSessions(
    @CurrentSession() session: SessionContext,
    @Param('employeeId', new ParseUUIDPipe({ version: '4' }))
    employeeId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.setNoStore(response);

    await this.employeesService.revokeEmployeeSessions(
      session.organizationId,
      employeeId,
    );
  }

  private setNoStore(response: Response): void {
    response.setHeader('Cache-Control', 'no-store');
  }

  private serializeInvitationResult(result: EmployeeInvitationResult) {
    return {
      status: result.status,
      employee: this.serializeEmployee(result.employee),
      activation: result.activation
        ? {
            token: result.activation.token,
            expiresAt: result.activation.expiresAt.toISOString(),
          }
        : null,
    };
  }

  private serializeEmployeeList(result: EmployeeListResult) {
    return {
      items: result.items.map((employee) => this.serializeEmployee(employee)),
      pagination: result.pagination,
    };
  }

  private serializeEmployee(employee: EmployeeDetailRecord) {
    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phone,
      status: employee.status,
      user: {
        id: employee.user.id,
        email: employee.user.email,
        status: employee.user.status,
        emailVerifiedAt: employee.user.emailVerifiedAt?.toISOString() ?? null,
      },
      facilities: employee.facilities.map((facility) => ({
        id: facility.id,
        code: facility.code,
        name: facility.name,
        type: facility.type,
        isPrimary: facility.isPrimary,
      })),
      roles: employee.roles.map((role) => ({
        id: role.id,
        code: role.code,
        name: role.name,
        isActive: role.isActive,
      })),
      createdAt: employee.createdAt.toISOString(),
      updatedAt: employee.updatedAt.toISOString(),
    };
  }
}
