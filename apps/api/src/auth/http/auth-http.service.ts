import type { Response } from 'express';
import { Injectable } from '@nestjs/common';

import { OrganizationAccessDeniedError } from '../auth.errors';
import { AuthService } from '../auth.service';
import type { AuthenticationMembership } from '../auth.types';
import {
  InvalidLoginChallengeError,
  InvalidLoginChallengeInputError,
} from '../login-challenges/login-challenge.errors';
import { LoginChallengesService } from '../login-challenges/login-challenges.service';
import type { AuthenticatedRequest } from './authenticated-request.type';
import { AuthCookieService } from './auth-cookie.service';
import { CsrfTokenService } from './csrf-token.service';
import type { LoginDto } from './dto/login.dto';
import type { SelectOrganizationDto } from './dto/select-organization.dto';
import {
  InvalidSessionInputError,
  InvalidSessionTokenError,
} from '../../sessions/session.errors';
import { SessionsService } from '../../sessions/sessions.service';
import type { SessionContext } from '../../sessions/session.types';

export interface SerializedSessionContext {
  sessionId: string;
  userId: string;
  email: string;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  facilityIds: string[];
  expiresAt: string;
  employeeCode?: string;
  primaryFacilityId?: string;
}

@Injectable()
export class AuthHttpService {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
    private readonly loginChallengesService: LoginChallengesService,
    private readonly authCookieService: AuthCookieService,
    private readonly csrfTokenService: CsrfTokenService,
  ) {}

  issueCsrfToken(response: Response): { csrfToken: string } {
    const csrfToken = this.csrfTokenService.createToken();

    this.setNoStore(response);
    this.authCookieService.setCsrfCookie(response, csrfToken);

    return { csrfToken };
  }

  async login(
    request: AuthenticatedRequest,
    response: Response,
    body: LoginDto,
  ): Promise<
    | {
        status: 'authenticated';
        session: SerializedSessionContext;
      }
    | {
        status: 'organization_selection_required';
        organizations: AuthenticationMembership[];
      }
  > {
    this.setNoStore(response);

    const authenticatedUser = await this.authService.authenticateCredentials({
      email: body.email,
      password: body.password,
    });
    const organizations = request.tenantHost
      ? authenticatedUser.organizations.filter(
          (organization) =>
            organization.organizationId === request.tenantHost?.organizationId,
        )
      : authenticatedUser.organizations;

    if (organizations.length === 0) {
      throw new OrganizationAccessDeniedError();
    }

    if (organizations.length === 1) {
      const context = await this.authService.selectOrganization({
        userId: authenticatedUser.userId,
        organizationId: organizations[0].organizationId,
      });
      const createdSession = await this.sessionsService.createSession({
        userId: context.userId,
        organizationId: context.organizationId,
        ipAddress: this.normalizeIpAddress(request.ip),
        userAgent: this.normalizeUserAgent(request.headers['user-agent']),
      });

      await this.revokeExistingSessionIfPresent(request);
      this.authCookieService.clearLoginChallengeCookie(response);
      this.authCookieService.setSessionCookie(
        response,
        createdSession.sessionToken,
        createdSession.session.expiresAt,
      );

      return {
        status: 'authenticated',
        session: this.serializeSession(createdSession.session),
      };
    }

    const challenge = await this.loginChallengesService.createChallenge({
      userId: authenticatedUser.userId,
    });

    await this.revokeExistingSessionIfPresent(request);
    this.authCookieService.clearSessionCookie(response);
    this.authCookieService.setLoginChallengeCookie(
      response,
      challenge.token,
      challenge.expiresAt,
    );

    return {
      status: 'organization_selection_required',
      organizations,
    };
  }

  async selectOrganization(
    request: AuthenticatedRequest,
    response: Response,
    body: SelectOrganizationDto,
  ): Promise<{
    status: 'authenticated';
    session: SerializedSessionContext;
  }> {
    this.setNoStore(response);

    if (
      request.tenantHost &&
      request.tenantHost.organizationId !== body.organizationId
    ) {
      throw new OrganizationAccessDeniedError();
    }

    const challengeToken =
      this.authCookieService.readLoginChallengeToken(request);

    if (!challengeToken) {
      this.authCookieService.clearLoginChallengeCookie(response);
      throw new InvalidLoginChallengeError();
    }

    let consumedChallengeUserId: string;

    try {
      const consumedChallenge =
        await this.loginChallengesService.consumeChallenge({
          challengeToken,
        });
      consumedChallengeUserId = consumedChallenge.userId;
    } catch (error) {
      this.authCookieService.clearLoginChallengeCookie(response);

      if (
        error instanceof InvalidLoginChallengeError ||
        error instanceof InvalidLoginChallengeInputError
      ) {
        throw new InvalidLoginChallengeError();
      }

      throw error;
    }

    this.authCookieService.clearLoginChallengeCookie(response);

    const context = await this.authService.selectOrganization({
      userId: consumedChallengeUserId,
      organizationId: body.organizationId,
    });
    const createdSession = await this.sessionsService.createSession({
      userId: context.userId,
      organizationId: context.organizationId,
      ipAddress: this.normalizeIpAddress(request.ip),
      userAgent: this.normalizeUserAgent(request.headers['user-agent']),
    });

    await this.revokeExistingSessionIfPresent(request);
    this.authCookieService.setSessionCookie(
      response,
      createdSession.sessionToken,
      createdSession.session.expiresAt,
    );

    return {
      status: 'authenticated',
      session: this.serializeSession(createdSession.session),
    };
  }

  getCurrentSession(
    response: Response,
    session: SessionContext,
  ): { session: SerializedSessionContext } {
    this.setNoStore(response);

    return {
      session: this.serializeSession(session),
    };
  }

  async rotateSession(
    request: AuthenticatedRequest,
    response: Response,
  ): Promise<void> {
    this.setNoStore(response);

    const sessionToken = this.authCookieService.readSessionToken(request);

    if (!sessionToken) {
      throw new InvalidSessionTokenError();
    }

    const rotatedSession = await this.sessionsService.rotateSession({
      sessionToken,
      ipAddress: this.normalizeIpAddress(request.ip),
      userAgent: this.normalizeUserAgent(request.headers['user-agent']),
    });

    this.authCookieService.setSessionCookie(
      response,
      rotatedSession.sessionToken,
      rotatedSession.session.expiresAt,
    );
  }

  async logout(
    request: AuthenticatedRequest,
    response: Response,
  ): Promise<void> {
    this.setNoStore(response);

    const sessionToken = this.authCookieService.readSessionToken(request);

    if (sessionToken) {
      try {
        await this.sessionsService.revokeSession({ sessionToken });
      } catch (error) {
        if (
          !(error instanceof InvalidSessionInputError) &&
          !(error instanceof InvalidSessionTokenError)
        ) {
          throw error;
        }
      }
    }

    this.authCookieService.clearSessionCookie(response);
    this.authCookieService.clearLoginChallengeCookie(response);
    this.authCookieService.clearCsrfCookie(response);
  }

  private serializeSession(session: SessionContext): SerializedSessionContext {
    return {
      sessionId: session.sessionId,
      userId: session.userId,
      email: session.email,
      organizationId: session.organizationId,
      organizationSlug: session.organizationSlug,
      organizationName: session.organizationName,
      employeeId: session.employeeId,
      firstName: session.firstName,
      lastName: session.lastName,
      facilityIds: session.facilityIds,
      expiresAt: session.expiresAt.toISOString(),
      employeeCode: session.employeeCode,
      primaryFacilityId: session.primaryFacilityId,
    };
  }

  private setNoStore(response: Response): void {
    response.setHeader('Cache-Control', 'no-store');
  }

  private normalizeIpAddress(
    ipAddress: string | undefined,
  ): string | undefined {
    if (typeof ipAddress !== 'string') {
      return undefined;
    }

    const normalizedIpAddress = ipAddress.trim();

    return normalizedIpAddress.length > 0 ? normalizedIpAddress : undefined;
  }

  private normalizeUserAgent(
    userAgentHeader: string | string[] | undefined,
  ): string | undefined {
    if (typeof userAgentHeader === 'string') {
      const normalizedUserAgent = userAgentHeader.trim();
      return normalizedUserAgent.length > 0 ? normalizedUserAgent : undefined;
    }

    return undefined;
  }

  private async revokeExistingSessionIfPresent(
    request: AuthenticatedRequest,
  ): Promise<void> {
    const currentSessionToken =
      this.authCookieService.readSessionToken(request);

    if (!currentSessionToken) {
      return;
    }

    try {
      await this.sessionsService.revokeSession({
        sessionToken: currentSessionToken,
      });
    } catch (error) {
      if (
        !(error instanceof InvalidSessionInputError) &&
        !(error instanceof InvalidSessionTokenError)
      ) {
        throw error;
      }
    }
  }
}
