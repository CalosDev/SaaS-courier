import {
  OnboardingAlreadyCompletedError,
  OnboardingRequirementsIncompleteError,
} from './organization-settings.errors';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService', () => {
  const repository = {
    getOnboardingSnapshot: jest.fn(),
    markOnboardingCompleted: jest.fn(),
  };
  const service = new OnboardingService(repository as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns READY when all required steps are satisfied but completion was not confirmed', async () => {
    const completedAt = null;
    repository.getOnboardingSnapshot.mockResolvedValueOnce({
      organizationProfileCompleted: true,
      operationalSettingsCompleted: true,
      customerCodePolicyCompleted: true,
      activeFacilities: 1,
      activeEmployees: 1,
      activeRolesWithPermissions: 1,
      onboardingCompletedAt: completedAt,
    });

    await expect(
      service.getCurrent('f6b9597f-3bd5-49db-b9c2-e5f7aa5b2579'),
    ).resolves.toMatchObject({
      status: 'READY',
      completedAt: null,
    });
  });

  it('completes onboarding once and returns COMPLETED', async () => {
    const completedAt = new Date('2026-07-01T12:00:00.000Z');
    repository.getOnboardingSnapshot
      .mockResolvedValueOnce({
        organizationProfileCompleted: true,
        operationalSettingsCompleted: true,
        customerCodePolicyCompleted: true,
        activeFacilities: 1,
        activeEmployees: 1,
        activeRolesWithPermissions: 1,
        onboardingCompletedAt: null,
      })
      .mockResolvedValueOnce({
        organizationProfileCompleted: true,
        operationalSettingsCompleted: true,
        customerCodePolicyCompleted: true,
        activeFacilities: 1,
        activeEmployees: 1,
        activeRolesWithPermissions: 1,
        onboardingCompletedAt: completedAt,
      });
    repository.markOnboardingCompleted.mockResolvedValueOnce(completedAt);

    await expect(
      service.complete('6f7d6ce8-f97c-469d-98cf-0c8a2f94aa7a'),
    ).resolves.toMatchObject({
      status: 'COMPLETED',
      completedAt,
    });
  });

  it('rejects completion when requirements are incomplete', async () => {
    repository.getOnboardingSnapshot.mockResolvedValueOnce({
      organizationProfileCompleted: true,
      operationalSettingsCompleted: true,
      customerCodePolicyCompleted: false,
      activeFacilities: 0,
      activeEmployees: 1,
      activeRolesWithPermissions: 1,
      onboardingCompletedAt: null,
    });

    await expect(
      service.complete('8e2ef5d8-f570-4f5b-849e-33c9ae3280e0'),
    ).rejects.toBeInstanceOf(OnboardingRequirementsIncompleteError);
  });

  it('is idempotent after completion', async () => {
    const completedAt = new Date('2026-07-01T12:00:00.000Z');
    repository.getOnboardingSnapshot.mockResolvedValueOnce({
      organizationProfileCompleted: true,
      operationalSettingsCompleted: true,
      customerCodePolicyCompleted: true,
      activeFacilities: 1,
      activeEmployees: 1,
      activeRolesWithPermissions: 1,
      onboardingCompletedAt: completedAt,
    });

    await expect(
      service.complete('592e67f4-36dd-40d3-8280-0a1545e7f96c'),
    ).rejects.toBeInstanceOf(OnboardingAlreadyCompletedError);
  });
});
