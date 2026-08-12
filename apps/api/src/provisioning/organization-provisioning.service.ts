import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { ActivationTokenService } from '../accounts/activation-token.service';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import {
  FACILITY_OWNERSHIP_TYPE_VALUES,
  FACILITY_TYPE_VALUES,
} from '../facilities/facility.types';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSION_CATALOG } from '../rbac/permission.catalog';
import {
  COURIER_REGISTRATION_STATUS_VALUES,
  ELECTRONIC_INVOICING_STATUS_VALUES,
} from '../organizations/organization-regulatory-profile.types';
import {
  OrganizationProvisioningConflictError,
  OrganizationProvisioningError,
} from './organization-provisioning.errors';
import type {
  ProvisionOrganizationInput,
  ProvisionOrganizationResult,
} from './organization-provisioning.types';

const ACTIVATION_TTL_MS = 24 * 60 * 60 * 1000;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,39}$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const DGA_OPERATOR_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._/-]{0,79}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class OrganizationProvisioningService {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly activationTokens: ActivationTokenService,
  ) {}

  async provision(
    rawInput: ProvisionOrganizationInput,
  ): Promise<ProvisionOrganizationResult> {
    const input = this.normalize(rawInput);
    const activation = this.activationTokens.createSecret();
    const activationExpiresAt = new Date(Date.now() + ACTIVATION_TTL_MS);
    const trialEndsAt = new Date(
      Date.now() + input.organization.trialDays * 24 * 60 * 60 * 1000,
    );

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const permissions = await tx.permission.findMany({
          where: {
            code: { in: PERMISSION_CATALOG.map((item) => item.code) },
            isActive: true,
          },
          select: { id: true, code: true },
        });
        if (permissions.length !== PERMISSION_CATALOG.length) {
          throw new OrganizationProvisioningError(
            'Permission catalog must be synchronized before provisioning',
          );
        }

        const organization = await tx.organization.create({
          data: {
            legalName: input.organization.legalName,
            commercialName: input.organization.commercialName,
            slug: input.organization.slug,
            rnc: input.organization.rnc,
            email: input.organization.email,
            phone: input.organization.phone,
            status: 'TRIAL',
            planCode: input.organization.planCode,
            maxUsers: input.organization.maxUsers,
            maxFacilities: input.organization.maxFacilities,
            trialEndsAt,
            settings: { create: {} },
            regulatoryProfile: {
              create: {
                fiscalAddress: input.regulatoryProfile.fiscalAddress,
                authorizedRepresentativeName:
                  input.regulatoryProfile.authorizedRepresentativeName,
                authorizedRepresentativeEmail:
                  input.regulatoryProfile.authorizedRepresentativeEmail,
                authorizedRepresentativePhone:
                  input.regulatoryProfile.authorizedRepresentativePhone,
                courierRegistrationStatus:
                  input.regulatoryProfile.courierRegistrationStatus,
                dgaOperatorCode: input.regulatoryProfile.dgaOperatorCode,
                electronicInvoicingStatus:
                  input.regulatoryProfile.electronicInvoicingStatus,
                declaredAt: new Date(),
              },
            },
          },
        });

        const facility = await tx.facility.create({
          data: {
            organizationId: organization.id,
            code: input.primaryFacility.code,
            name: input.primaryFacility.name,
            type: input.primaryFacility.type,
            ownershipType: input.primaryFacility.ownershipType,
            countryCode: input.primaryFacility.countryCode,
            province: input.primaryFacility.province,
            city: input.primaryFacility.city,
            addressLine1: input.primaryFacility.addressLine1,
            addressLine2: input.primaryFacility.addressLine2,
            phone: input.primaryFacility.phone,
            email: input.primaryFacility.email,
            isCustomerFacing: input.primaryFacility.isCustomerFacing,
            isPackageOrigin: input.primaryFacility.isPackageOrigin,
            isDistributionCenter: input.primaryFacility.isDistributionCenter,
            isActive: true,
          },
        });

        const user = await tx.user.create({
          data: {
            email: input.administrator.email,
            status: 'INVITED',
            passwordHash: null,
            activationTokens: {
              create: {
                tokenHash: activation.tokenHash,
                expiresAt: activationExpiresAt,
              },
            },
          },
        });
        const employee = await tx.employee.create({
          data: {
            organizationId: organization.id,
            userId: user.id,
            employeeCode: input.administrator.employeeCode,
            firstName: input.administrator.firstName,
            lastName: input.administrator.lastName,
            phone: input.administrator.phone,
            status: 'PENDING',
          },
        });
        const role = await tx.role.create({
          data: {
            organizationId: organization.id,
            code: 'ORGANIZATION_ADMIN',
            name: 'Administrador de organizacion',
            description: 'Rol inicial administrado por la plataforma',
            isSystem: true,
          },
        });

        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({
            organizationId: organization.id,
            roleId: role.id,
            permissionId: permission.id,
          })),
        });
        await tx.employeeRole.create({
          data: {
            organizationId: organization.id,
            employeeId: employee.id,
            roleId: role.id,
          },
        });
        await tx.employeeFacility.create({
          data: {
            organizationId: organization.id,
            employeeId: employee.id,
            facilityId: facility.id,
            isPrimary: true,
          },
        });

        const requestId = randomUUID();
        await this.auditWriter.write(tx, {
          context: {
            organizationId: organization.id,
            actorType: 'SYSTEM',
            actorUserId: null,
            actorEmployeeId: null,
            source: 'SYSTEM',
            requestId,
            correlationId: `provisioning:${requestId}`,
            ipAddress: null,
            userAgent: 'organization-provisioning-cli',
          },
          action: 'organization.provisioned',
          entityType: 'ORGANIZATION',
          entityId: organization.id,
          changedFields: [
            'organization',
            'regulatoryProfile',
            'primaryFacility',
            'administrator',
            'administratorRole',
          ],
          afterData: {
            slug: organization.slug,
            status: organization.status,
            planCode: organization.planCode,
            regulatoryProfileConfigured: true,
            primaryFacilityConfigured: true,
            administratorInvited: true,
          },
          payload: {
            organizationId: organization.id,
            organizationSlug: organization.slug,
            facilityId: facility.id,
            administratorEmployeeId: employee.id,
          },
        });

        return {
          organizationId: organization.id,
          organizationSlug: organization.slug,
          facilityId: facility.id,
          administratorEmployeeId: employee.id,
        };
      });

      return {
        ...result,
        administratorEmail: input.administrator.email,
        activationToken: activation.token,
        activationExpiresAt,
      };
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new OrganizationProvisioningConflictError(
          'Organization slug, facility code, employee code or administrator email is already in use',
        );
      }
      throw error;
    }
  }

  private normalize(input: ProvisionOrganizationInput) {
    if (!input || typeof input !== 'object') {
      throw new OrganizationProvisioningError('Provisioning input is required');
    }
    const organization = input.organization;
    const regulatory = input.regulatoryProfile;
    const facility = input.primaryFacility;
    const administrator = input.administrator;
    if (!organization || !regulatory || !facility || !administrator) {
      throw new OrganizationProvisioningError(
        'Organization, regulatoryProfile, primaryFacility and administrator are required',
      );
    }

    const slug = this.required(
      organization.slug,
      'organization.slug',
      80,
    ).toLowerCase();
    if (!SLUG_PATTERN.test(slug))
      this.fail('organization.slug format is invalid');
    const rnc = this.required(organization.rnc, 'organization.rnc', 20);
    const organizationEmail = this.email(
      organization.email,
      'organization.email',
    );
    const administratorEmail = this.email(
      administrator.email,
      'administrator.email',
    );
    const facilityCode = this.required(
      facility.code,
      'primaryFacility.code',
      40,
    ).toUpperCase();
    if (!CODE_PATTERN.test(facilityCode))
      this.fail('primaryFacility.code format is invalid');

    const maxUsers = this.integer(
      organization.maxUsers ?? 5,
      1,
      10000,
      'maxUsers',
    );
    const maxFacilities = this.integer(
      organization.maxFacilities ?? 2,
      1,
      1000,
      'maxFacilities',
    );
    const trialDays = this.integer(
      organization.trialDays ?? 30,
      1,
      365,
      'trialDays',
    );
    const dgaOperatorCode =
      this.optional(regulatory.dgaOperatorCode, 80)?.toUpperCase() ?? null;
    if (dgaOperatorCode && !DGA_OPERATOR_CODE_PATTERN.test(dgaOperatorCode)) {
      this.fail('regulatoryProfile.dgaOperatorCode format is invalid');
    }
    const countryCode = this.required(
      facility.countryCode ?? 'DO',
      'primaryFacility.countryCode',
      2,
    ).toUpperCase();
    if (!COUNTRY_CODE_PATTERN.test(countryCode)) {
      this.fail('primaryFacility.countryCode format is invalid');
    }
    const employeeCode =
      this.optional(administrator.employeeCode, 40)?.toUpperCase() ?? null;
    if (employeeCode && !CODE_PATTERN.test(employeeCode)) {
      this.fail('administrator.employeeCode format is invalid');
    }

    return {
      organization: {
        legalName: this.required(
          organization.legalName,
          'organization.legalName',
          200,
        ),
        commercialName: this.required(
          organization.commercialName,
          'organization.commercialName',
          120,
        ),
        slug,
        rnc,
        email: organizationEmail,
        phone: this.optional(organization.phone, 32),
        planCode: this.required(
          organization.planCode ?? 'PILOT',
          'planCode',
          40,
        ).toUpperCase(),
        maxUsers,
        maxFacilities,
        trialDays,
      },
      regulatoryProfile: {
        fiscalAddress: this.required(
          regulatory.fiscalAddress,
          'regulatoryProfile.fiscalAddress',
          500,
        ),
        authorizedRepresentativeName: this.required(
          regulatory.authorizedRepresentativeName,
          'regulatoryProfile.authorizedRepresentativeName',
          200,
        ),
        authorizedRepresentativeEmail: regulatory.authorizedRepresentativeEmail
          ? this.email(
              regulatory.authorizedRepresentativeEmail,
              'regulatoryProfile.authorizedRepresentativeEmail',
            )
          : null,
        authorizedRepresentativePhone: this.optional(
          regulatory.authorizedRepresentativePhone,
          32,
        ),
        courierRegistrationStatus: this.enumValue(
          regulatory.courierRegistrationStatus,
          COURIER_REGISTRATION_STATUS_VALUES,
          'courierRegistrationStatus',
        ),
        dgaOperatorCode,
        electronicInvoicingStatus: this.enumValue(
          regulatory.electronicInvoicingStatus,
          ELECTRONIC_INVOICING_STATUS_VALUES,
          'electronicInvoicingStatus',
        ),
      },
      primaryFacility: {
        code: facilityCode,
        name: this.required(facility.name, 'primaryFacility.name', 160),
        type: this.enumValue(
          facility.type,
          FACILITY_TYPE_VALUES,
          'primaryFacility.type',
        ),
        ownershipType: this.enumValue(
          facility.ownershipType ?? 'OWNED',
          FACILITY_OWNERSHIP_TYPE_VALUES,
          'primaryFacility.ownershipType',
        ),
        countryCode,
        province: this.optional(facility.province, 120),
        city: this.optional(facility.city, 120),
        addressLine1: this.required(
          facility.addressLine1,
          'primaryFacility.addressLine1',
          240,
        ),
        addressLine2: this.optional(facility.addressLine2, 240),
        phone: this.optional(facility.phone, 32),
        email: facility.email
          ? this.email(facility.email, 'primaryFacility.email')
          : null,
        isCustomerFacing: this.boolean(
          facility.isCustomerFacing ?? true,
          'primaryFacility.isCustomerFacing',
        ),
        isPackageOrigin: this.boolean(
          facility.isPackageOrigin ?? false,
          'primaryFacility.isPackageOrigin',
        ),
        isDistributionCenter: this.boolean(
          facility.isDistributionCenter ?? false,
          'primaryFacility.isDistributionCenter',
        ),
      },
      administrator: {
        email: administratorEmail,
        firstName: this.required(
          administrator.firstName,
          'administrator.firstName',
          120,
        ),
        lastName: this.required(
          administrator.lastName,
          'administrator.lastName',
          120,
        ),
        phone: this.optional(administrator.phone, 32),
        employeeCode,
      },
    };
  }

  private required(value: string, field: string, max: number): string {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized || normalized.length > max)
      this.fail(`${field} is invalid`);
    return normalized;
  }

  private optional(value: string | undefined, max: number): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    if (normalized.length > max) this.fail('Optional field exceeds its limit');
    return normalized || null;
  }

  private email(value: string, field: string): string {
    const normalized = this.required(value, field, 320).toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) this.fail(`${field} is invalid`);
    return normalized;
  }

  private integer(
    value: number,
    min: number,
    max: number,
    field: string,
  ): number {
    if (!Number.isInteger(value) || value < min || value > max)
      this.fail(`${field} is invalid`);
    return value;
  }

  private boolean(value: boolean, field: string): boolean {
    if (typeof value !== 'boolean') this.fail(`${field} is invalid`);
    return value;
  }

  private enumValue<T extends readonly string[]>(
    value: string,
    values: T,
    field: string,
  ): T[number] {
    if (!values.includes(value)) this.fail(`${field} is invalid`);
    return value;
  }

  private fail(message: string): never {
    throw new OrganizationProvisioningError(message);
  }

  private isUniqueConflict(error: unknown): boolean {
    return error instanceof Error && 'code' in error && error.code === 'P2002';
  }
}
