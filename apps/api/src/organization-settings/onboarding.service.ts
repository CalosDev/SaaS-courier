import { Inject, Injectable } from '@nestjs/common';
import { OrganizationSettingsRepository } from './organization-settings.repository';
import type {
  OnboardingRecord,
  OnboardingSnapshot,
  OnboardingStepRecord,
} from './organization-settings.types';
import {
  OnboardingAlreadyCompletedError,
  OnboardingRequirementsIncompleteError,
  OrganizationSettingsNotFoundError,
} from './organization-settings.errors';
import type { CommandContext } from '../request-context/request-context.types';

@Injectable()
export class OnboardingService {
  constructor(
    @Inject(OrganizationSettingsRepository)
    private readonly organizationSettingsRepository: OrganizationSettingsRepository,
  ) {}

  async getCurrent(organizationId: string): Promise<OnboardingRecord> {
    const snapshot =
      await this.organizationSettingsRepository.getOnboardingSnapshot(
        organizationId,
      );

    if (!snapshot) {
      throw new OrganizationSettingsNotFoundError(organizationId);
    }

    return this.toOnboardingRecord(snapshot);
  }

  async complete(
    organizationId: string,
    context?: CommandContext,
  ): Promise<OnboardingRecord> {
    const snapshot =
      await this.organizationSettingsRepository.getOnboardingSnapshot(
        organizationId,
      );

    if (!snapshot) {
      throw new OrganizationSettingsNotFoundError(organizationId);
    }

    const current = this.toOnboardingRecord(snapshot);

    if (current.status === 'COMPLETED') {
      throw new OnboardingAlreadyCompletedError();
    }

    if (current.status !== 'READY') {
      throw new OnboardingRequirementsIncompleteError();
    }

    if (context) {
      await this.organizationSettingsRepository.markOnboardingCompleted(
        organizationId,
        context,
      );
    } else {
      await this.organizationSettingsRepository.markOnboardingCompleted(
        organizationId,
      );
    }

    const completedSnapshot =
      await this.organizationSettingsRepository.getOnboardingSnapshot(
        organizationId,
      );

    if (!completedSnapshot) {
      throw new OrganizationSettingsNotFoundError(organizationId);
    }

    return this.toOnboardingRecord(completedSnapshot);
  }

  private toOnboardingRecord(snapshot: OnboardingSnapshot): OnboardingRecord {
    const steps: OnboardingStepRecord[] = [
      {
        code: 'ORGANIZATION_PROFILE',
        required: true,
        completed: snapshot.organizationProfileCompleted,
      },
      {
        code: 'OPERATIONAL_SETTINGS',
        required: true,
        completed: snapshot.operationalSettingsCompleted,
      },
      {
        code: 'CUSTOMER_CODE_POLICY',
        required: true,
        completed: snapshot.customerCodePolicyCompleted,
      },
      {
        code: 'ACTIVE_FACILITY',
        required: true,
        completed: snapshot.activeFacilities > 0,
      },
      {
        code: 'ACTIVE_EMPLOYEE',
        required: true,
        completed: snapshot.activeEmployees > 0,
      },
      {
        code: 'ACTIVE_ROLE',
        required: true,
        completed: snapshot.activeRolesWithPermissions > 0,
      },
    ];
    const completedSteps = steps.filter((step) => step.completed).length;
    const allCompleted = completedSteps === steps.length;

    return {
      status: snapshot.onboardingCompletedAt
        ? 'COMPLETED'
        : allCompleted
          ? 'READY'
          : completedSteps === 0
            ? 'NOT_STARTED'
            : 'IN_PROGRESS',
      completedAt: snapshot.onboardingCompletedAt,
      steps,
    };
  }
}
