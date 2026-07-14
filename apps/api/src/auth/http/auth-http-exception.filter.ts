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
  InvalidActivationTokenError,
  InvalidAccountInputError,
  InvalidPasswordError,
} from '../../accounts/account.errors';
import {
  EmployeeCodeConflictError,
  EmployeeFacilityNotFoundError,
  EmployeeInvitationUserUnavailableError,
  EmployeeMaxUsersExceededError,
  EmployeeMembershipConflictError,
  EmployeeNotFoundError,
  EmployeeRoleNotFoundError,
  EmployeeSelfManagementError,
  InvalidEmployeeInputError,
} from '../../employees/employee.errors';
import {
  AuthorizationPolicyMissingError,
  InsufficientPermissionsError,
} from '../../rbac/http/authorization.errors';
import {
  InvalidRoleInputError,
  PermissionCatalogNotSynchronizedError,
  RoleCodeConflictError,
  RoleNotFoundError,
  SystemRoleImmutableError,
  UnknownPermissionCodeError,
} from '../../rbac/rbac.errors';
import {
  FacilityCodeConflictError,
  FacilityLimitReachedError,
  FacilityNotFoundError,
  FacilityOrganizationUnavailableError,
  InvalidFacilityInputError,
} from '../../facilities/facility.errors';
import {
  CustomerAddressNotFoundError,
  CustomerCodeGenerationError,
  CustomerCustomsProfileNotFoundError,
  CustomerIdentityConflictError,
  CustomerNotFoundError,
  InvalidCustomerCustomsProfileError,
  InvalidCustomerInputError,
} from '../../customers/customer.errors';
import {
  CustomerImportJobNotFoundError,
  CustomerImportStateConflictError,
  CustomerImportValidationError,
  InvalidCustomerImportInputError,
} from '../../customer-imports/customer-imports.errors';
import {
  InvalidPrealertInputError,
  InvalidPrealertStateTransitionError,
  PrealertCodeGenerationError,
  PrealertCustomerUnavailableError,
  PrealertImmutableError,
  PrealertNotFoundError,
  PrealertTrackingConflictError,
} from '../../prealerts/prealert.errors';
import {
  InvalidPackageInputError,
  InvalidPackageStatusTransitionError,
  PackageCodeGenerationError,
  PackageCustomerUnavailableError,
  PackageImmutableError,
  PackageNotFoundError,
  PackagePrealertMatchRequiredError,
  PackagePrealertUnavailableError,
  PackageTrackingConflictError,
} from '../../packages/package.errors';
import {
  PackageReceptionConflictError,
  PackageReceptionFacilityUnavailableError,
  PackageReceptionNotFoundError,
} from '../../packages/package-reception.errors';
import {
  InvalidPackageDocumentInputError,
  PackageDocumentNotFoundError,
  PackageDocumentScanUnavailableError,
  PackageDocumentStateConflictError,
  PackageDocumentStorageUnavailableError,
} from '../../packages/package-document.errors';
import {
  InvalidInventoryInputError,
  InventoryMovementConflictError,
  WarehouseLocationCodeConflictError,
  WarehouseLocationNotFoundError,
  WarehouseLocationUnavailableError,
} from '../../inventory/inventory.errors';
import {
  CourierServiceCodeConflictError,
  CourierServiceNotFoundError,
  CourierServiceUnavailableError,
  InvalidRatesInputError,
  RateCardConflictError,
  RateCardNotFoundError,
  RateQuoteConflictError,
} from '../../rates/rates.errors';
import {
  InvalidOrganizationInputError,
  OrganizationNotFoundError,
  OrganizationSlugConflictError,
} from '../../organizations/organization.errors';
import {
  InvalidOrganizationSettingsInputError,
  OnboardingAlreadyCompletedError,
  OnboardingRequirementsIncompleteError,
  OrganizationSettingsNotFoundError,
} from '../../organization-settings/organization-settings.errors';
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
      exception instanceof InvalidCustomerInputError ||
      exception instanceof InvalidPrealertInputError ||
      exception instanceof InvalidPackageInputError ||
      exception instanceof InvalidPackageDocumentInputError ||
      exception instanceof InvalidInventoryInputError ||
      exception instanceof InvalidRatesInputError ||
      exception instanceof InvalidCustomerImportInputError ||
      exception instanceof InvalidCustomerCustomsProfileError ||
      exception instanceof InvalidEmployeeInputError ||
      exception instanceof InvalidRoleInputError ||
      exception instanceof InvalidAccountInputError ||
      exception instanceof InvalidPasswordError ||
      exception instanceof InvalidOrganizationSettingsInputError ||
      exception instanceof UnknownPermissionCodeError ||
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
      exception instanceof InvalidLoginChallengeError ||
      exception instanceof InvalidActivationTokenError
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
      exception instanceof AuthorizationPolicyMissingError ||
      exception instanceof EmployeeSelfManagementError ||
      exception instanceof SystemRoleImmutableError
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
      exception instanceof FacilityOrganizationUnavailableError ||
      exception instanceof CustomerNotFoundError ||
      exception instanceof PrealertNotFoundError ||
      exception instanceof PackageNotFoundError ||
      exception instanceof PackageDocumentNotFoundError ||
      exception instanceof WarehouseLocationNotFoundError ||
      exception instanceof CourierServiceNotFoundError ||
      exception instanceof RateCardNotFoundError ||
      exception instanceof PackageReceptionNotFoundError ||
      exception instanceof CustomerImportJobNotFoundError ||
      exception instanceof CustomerAddressNotFoundError ||
      exception instanceof CustomerCustomsProfileNotFoundError ||
      exception instanceof EmployeeNotFoundError ||
      exception instanceof EmployeeFacilityNotFoundError ||
      exception instanceof EmployeeRoleNotFoundError ||
      exception instanceof RoleNotFoundError ||
      exception instanceof OrganizationSettingsNotFoundError
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
      exception instanceof FacilityLimitReachedError ||
      exception instanceof CustomerIdentityConflictError ||
      exception instanceof PrealertTrackingConflictError ||
      exception instanceof PrealertCustomerUnavailableError ||
      exception instanceof PrealertImmutableError ||
      exception instanceof InvalidPrealertStateTransitionError ||
      exception instanceof PackageTrackingConflictError ||
      exception instanceof PackageCustomerUnavailableError ||
      exception instanceof PackagePrealertMatchRequiredError ||
      exception instanceof PackagePrealertUnavailableError ||
      exception instanceof PackageImmutableError ||
      exception instanceof PackageDocumentStateConflictError ||
      exception instanceof WarehouseLocationCodeConflictError ||
      exception instanceof WarehouseLocationUnavailableError ||
      exception instanceof InventoryMovementConflictError ||
      exception instanceof CourierServiceCodeConflictError ||
      exception instanceof CourierServiceUnavailableError ||
      exception instanceof RateCardConflictError ||
      exception instanceof RateQuoteConflictError ||
      exception instanceof InvalidPackageStatusTransitionError ||
      exception instanceof PackageReceptionConflictError ||
      exception instanceof PackageReceptionFacilityUnavailableError ||
      exception instanceof EmployeeCodeConflictError ||
      exception instanceof EmployeeMembershipConflictError ||
      exception instanceof EmployeeMaxUsersExceededError ||
      exception instanceof EmployeeInvitationUserUnavailableError ||
      exception instanceof RoleCodeConflictError ||
      exception instanceof PermissionCatalogNotSynchronizedError ||
      exception instanceof CustomerImportValidationError ||
      exception instanceof CustomerImportStateConflictError ||
      exception instanceof OnboardingRequirementsIncompleteError ||
      exception instanceof OnboardingAlreadyCompletedError
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
      exception instanceof PackageDocumentStorageUnavailableError ||
      exception instanceof PackageDocumentScanUnavailableError
    ) {
      return {
        status: 503,
        code: exception.code,
        message: 'Service unavailable.',
      };
    }

    if (
      exception instanceof CustomerCodeGenerationError ||
      exception instanceof PrealertCodeGenerationError ||
      exception instanceof PackageCodeGenerationError
    ) {
      return {
        status: 500,
        code: exception.code,
        message: 'Internal server error.',
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

      if (status >= 400 && status < 600) {
        return {
          status,
          code: `HTTP_${status}`,
          message:
            status >= 500
              ? status === 503
                ? 'Service unavailable.'
                : 'Internal server error.'
              : this.messageForStatus(status),
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
        path.startsWith('/accounts') ||
        path.startsWith('/employees') ||
        path.startsWith('/roles') ||
        path.startsWith('/permissions') ||
        path.startsWith('/organizations') ||
        path.startsWith('/facilities') ||
        path.startsWith('/customers') ||
        path.startsWith('/customer-imports') ||
        path.startsWith('/inventory') ||
        path.startsWith('/services') ||
        path.startsWith('/rate-cards') ||
        path.startsWith('/rates') ||
        path.startsWith('/packages') ||
        path.startsWith('/prealerts'))
    );
  }
}
