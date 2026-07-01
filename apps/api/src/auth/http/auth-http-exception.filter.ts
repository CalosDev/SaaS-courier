import type { Response } from 'express';
import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';

import {
  AuthorizationPolicyMissingError,
  InsufficientPermissionsError,
} from '../../rbac/http/authorization.errors';
import {
  FacilityCodeConflictError,
  FacilityLimitReachedError,
  FacilityNotFoundError,
  FacilityOrganizationUnavailableError,
  InvalidFacilityInputError,
} from '../../facilities/facility.errors';
import {
  InvalidOrganizationInputError,
  OrganizationNotFoundError,
  OrganizationSlugConflictError,
} from '../../organizations/organization.errors';
import {
  AccountTemporarilyLockedError,
  InvalidAuthenticationInputError,
  InvalidCredentialsError,
  OrganizationAccessDeniedError,
} from '../auth.errors';
import {
  InvalidLoginChallengeError,
  InvalidLoginChallengeInputError,
} from '../login-challenges/login-challenge.errors';
import { CsrfValidationError } from './csrf.guard';
import {
  InvalidSessionInputError,
  InvalidSessionTokenError,
  SessionCreationDeniedError,
} from '../../sessions/session.errors';

@Catch()
export class AuthHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<{ path?: string }>();
    const mappedError = this.mapException(exception);

    if (this.requiresNoStore(request.path)) {
      response.setHeader('Cache-Control', 'no-store');
    }

    response.status(mappedError.status).json({
      error: {
        code: mappedError.code,
        message: mappedError.message,
      },
    });
  }

  private mapException(exception: unknown): {
    status: number;
    code: string;
    message: string;
  } {
    if (
      exception instanceof InvalidAuthenticationInputError ||
      exception instanceof InvalidSessionInputError ||
      exception instanceof InvalidLoginChallengeInputError ||
      exception instanceof InvalidOrganizationInputError ||
      exception instanceof InvalidFacilityInputError ||
      exception instanceof BadRequestException
    ) {
      return {
        status: 400,
        code:
          exception instanceof BadRequestException
            ? 'HTTP_BAD_REQUEST'
            : exception.code,
        message: 'Invalid request.',
      };
    }

    if (exception instanceof InvalidCredentialsError) {
      return {
        status: 401,
        code: exception.code,
        message: 'Authentication failed.',
      };
    }

    if (
      exception instanceof InvalidSessionTokenError ||
      exception instanceof InvalidLoginChallengeError
    ) {
      return {
        status: 401,
        code: exception.code,
        message: 'Authentication required.',
      };
    }

    if (
      exception instanceof OrganizationAccessDeniedError ||
      exception instanceof SessionCreationDeniedError ||
      exception instanceof CsrfValidationError ||
      exception instanceof InsufficientPermissionsError ||
      exception instanceof AuthorizationPolicyMissingError
    ) {
      return {
        status: 403,
        code:
          exception instanceof CsrfValidationError
            ? exception.code
            : exception.code,
        message:
          exception instanceof CsrfValidationError
            ? 'CSRF validation failed.'
            : exception instanceof InsufficientPermissionsError
              ? 'You do not have permission to perform this action.'
              : 'Forbidden.',
      };
    }

    if (
      exception instanceof OrganizationNotFoundError ||
      exception instanceof FacilityNotFoundError ||
      exception instanceof FacilityOrganizationUnavailableError
    ) {
      return {
        status: 404,
        code: exception.code,
        message: 'Not found.',
      };
    }

    if (
      exception instanceof OrganizationSlugConflictError ||
      exception instanceof FacilityCodeConflictError ||
      exception instanceof FacilityLimitReachedError
    ) {
      return {
        status: 409,
        code: exception.code,
        message:
          exception instanceof FacilityLimitReachedError
            ? 'Facility limit reached.'
            : 'Conflict.',
      };
    }

    if (
      exception instanceof AccountTemporarilyLockedError ||
      exception instanceof ThrottlerException
    ) {
      return {
        status: 429,
        code:
          exception instanceof AccountTemporarilyLockedError
            ? exception.code
            : 'HTTP_RATE_LIMITED',
        message: 'Too many requests.',
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();

      if (status >= 400 && status < 500) {
        return {
          status,
          code: `HTTP_${status}`,
          message: this.messageForStatus(status),
        };
      }
    }

    return {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error.',
    };
  }

  private messageForStatus(status: number): string {
    switch (status) {
      case 401:
        return 'Authentication required.';
      case 403:
        return 'Forbidden.';
      case 404:
        return 'Not found.';
      case 429:
        return 'Too many requests.';
      default:
        return 'Request failed.';
    }
  }

  private requiresNoStore(path: string | undefined): boolean {
    return (
      typeof path === 'string' &&
      (path.startsWith('/auth') ||
        path.startsWith('/organizations') ||
        path.startsWith('/facilities'))
    );
  }
}
