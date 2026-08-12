import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';

import type { SessionContext } from '../../sessions/session.types';
import { AuthenticatedOnly } from '../../rbac/http/authenticated-only.decorator';
import { RbacService } from '../../rbac/rbac.service';
import { AuthHttpService } from './auth-http.service';
import type { AuthenticatedRequest } from './authenticated-request.type';
import { CurrentSession } from './current-session.decorator';
import { LoginDto } from './dto/login.dto';
import { SelectOrganizationDto } from './dto/select-organization.dto';
import { Public } from './public.decorator';
import { TenantHostExempt } from '../../tenant-host/tenant-host-exempt.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authHttpService: AuthHttpService,
    private readonly rbacService: RbacService,
  ) {}

  @Get('csrf')
  @Public()
  @TenantHostExempt()
  @Throttle({
    default: {
      limit: 60,
      ttl: 60_000,
    },
  })
  getCsrf(@Res({ passthrough: true }) response: Response) {
    return this.authHttpService.issueCsrfToken(response);
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  @Throttle({
    default: {
      limit: 10,
      ttl: 300_000,
    },
  })
  login(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Body() body: LoginDto,
  ) {
    return this.authHttpService.login(request, response, body);
  }

  @Post('select-organization')
  @Public()
  @HttpCode(200)
  @Throttle({
    default: {
      limit: 20,
      ttl: 300_000,
    },
  })
  selectOrganization(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Body() body: SelectOrganizationDto,
  ) {
    return this.authHttpService.selectOrganization(request, response, body);
  }

  @Get('session')
  @AuthenticatedOnly()
  getSession(
    @CurrentSession() session: SessionContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authHttpService.getCurrentSession(response, session);
  }

  @Get('authorization')
  @AuthenticatedOnly()
  async getAuthorization(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ permissionCodes: string[] }> {
    response.setHeader('Cache-Control', 'no-store');
    const auth = request.auth!;

    return {
      permissionCodes: await this.rbacService.getEffectivePermissionCodes({
        organizationId: auth.organizationId,
        employeeId: auth.employeeId,
      }),
    };
  }

  @Post('session/rotate')
  @AuthenticatedOnly()
  @HttpCode(204)
  async rotateSession(
    @Req() request: AuthenticatedRequest,
    @CurrentSession() _session: SessionContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authHttpService.rotateSession(request, response);
  }

  @Post('logout')
  @Public()
  @TenantHostExempt()
  @HttpCode(204)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authHttpService.logout(request, response);
  }
}
