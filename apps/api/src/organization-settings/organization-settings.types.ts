export const DATE_DISPLAY_FORMAT_VALUES = ['DMY', 'MDY', 'YMD'] as const;
export const WEIGHT_UNIT_VALUES = ['LB', 'KG'] as const;
export const DIMENSION_UNIT_VALUES = ['IN', 'CM'] as const;
export const CUSTOMER_CODE_STRATEGY_VALUES = [
  'AUTO_RANDOM',
  'AUTO_SEQUENTIAL',
] as const;
export const ONBOARDING_STATUS_VALUES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'READY',
  'COMPLETED',
] as const;

export type DateDisplayFormat = (typeof DATE_DISPLAY_FORMAT_VALUES)[number];
export type WeightUnit = (typeof WEIGHT_UNIT_VALUES)[number];
export type DimensionUnit = (typeof DIMENSION_UNIT_VALUES)[number];
export type CustomerCodeStrategy =
  (typeof CUSTOMER_CODE_STRATEGY_VALUES)[number];
export type OnboardingStatus = (typeof ONBOARDING_STATUS_VALUES)[number];

export interface OrganizationSettingsRecord {
  locale: string;
  dateFormat: DateDisplayFormat;
  weightUnit: WeightUnit;
  dimensionUnit: DimensionUnit;
  customerCodeStrategy: CustomerCodeStrategy;
  customerCodePrefix: string;
  customerCodeRandomLength: number;
  customerCodeSequencePadding: number;
  nextCustomerSequence: number;
  onboardingCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationSettingsCurrentRecord {
  organization: {
    id: string;
    planCode: string;
    maxUsers: number;
    maxFacilities: number;
    countryCode: string;
    currencyCode: string;
    timezone: string;
  };
  settings: OrganizationSettingsRecord;
}

export interface UpdateOrganizationSettingsInput {
  locale?: string;
  dateFormat?: DateDisplayFormat;
  weightUnit?: WeightUnit;
  dimensionUnit?: DimensionUnit;
  timezone?: string;
  currencyCode?: string;
  countryCode?: string;
  customerCodeStrategy?: CustomerCodeStrategy;
  customerCodePrefix?: string;
  customerCodeRandomLength?: number;
  customerCodeSequencePadding?: number;
}

export interface UpdateOrganizationSettingsRecord {
  organizationId: string;
  locale?: string;
  dateFormat?: DateDisplayFormat;
  weightUnit?: WeightUnit;
  dimensionUnit?: DimensionUnit;
  timezone?: string;
  currencyCode?: string;
  countryCode?: string;
  customerCodeStrategy?: CustomerCodeStrategy;
  customerCodePrefix?: string;
  customerCodeRandomLength?: number;
  customerCodeSequencePadding?: number;
}

export interface OrganizationCapabilitiesSnapshot {
  organization: {
    id: string;
    planCode: string;
    maxUsers: number;
    maxFacilities: number;
  };
  usage: {
    users: number;
    facilities: number;
    customers: number;
  };
}

export interface OrganizationCapabilitiesRecord {
  planCode: string;
  modules: string[];
  limits: {
    maxUsers: number;
    maxFacilities: number;
  };
  usage: {
    users: number;
    facilities: number;
    customers: number;
  };
}

export interface PlanCatalogRecord {
  code: string;
  modules: readonly string[];
}

export interface OnboardingSnapshot {
  organizationProfileCompleted: boolean;
  operationalSettingsCompleted: boolean;
  customerCodePolicyCompleted: boolean;
  regulatoryProfileCompleted: boolean;
  activeFacilities: number;
  activeEmployees: number;
  activeRolesWithPermissions: number;
  onboardingCompletedAt: Date | null;
}

export interface OnboardingStepRecord {
  code:
    | 'ORGANIZATION_PROFILE'
    | 'OPERATIONAL_SETTINGS'
    | 'CUSTOMER_CODE_POLICY'
    | 'REGULATORY_PROFILE'
    | 'ACTIVE_FACILITY'
    | 'ACTIVE_EMPLOYEE'
    | 'ACTIVE_ROLE';
  required: true;
  completed: boolean;
}

export interface OnboardingRecord {
  status: OnboardingStatus;
  completedAt: Date | null;
  steps: OnboardingStepRecord[];
}
