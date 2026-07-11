import type { CommandContext } from '../request-context/request-context.types';

export const RATE_CALCULATION_TYPE_VALUES = [
  'FLAT',
  'PER_WEIGHT',
  'TIERED_WEIGHT',
  'PER_PIECE',
] as const;

export const RATE_CARD_STATUS_VALUES = ['DRAFT', 'ACTIVE', 'RETIRED'] as const;

export type RateCalculationType = (typeof RATE_CALCULATION_TYPE_VALUES)[number];
export type RateCardStatus = (typeof RATE_CARD_STATUS_VALUES)[number];

export interface CourierServiceRecord {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListCourierServicesInput {
  page?: number;
  pageSize?: number;
  q?: string;
  isActive?: boolean;
}

export interface ListCourierServicesRecord {
  organizationId: string;
  page: number;
  pageSize: number;
  q?: string;
  isActive?: boolean;
}

export interface CourierServiceListResult {
  items: CourierServiceRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface CreateCourierServiceInput {
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateCourierServiceRecord {
  organizationId: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface UpdateCourierServiceInput {
  code?: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateCourierServiceRecord {
  organizationId: string;
  serviceId: string;
  code?: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface RateCardServiceSummary {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface RateRuleRecord {
  id: string;
  sortOrder: number;
  minWeight: string | null;
  maxWeight: string | null;
  flatAmountMinor: bigint | null;
  unitAmountMinor: bigint | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RateCardRecord {
  id: string;
  organizationId: string;
  service: RateCardServiceSummary;
  previousRateCardId: string | null;
  name: string;
  segmentKey: string;
  segmentName: string;
  calculationType: RateCalculationType;
  version: number;
  status: RateCardStatus;
  currencyCode: string;
  weightUnit: 'LB' | 'KG';
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
  rules: RateRuleRecord[];
}

export interface ListRateCardsInput {
  page?: number;
  pageSize?: number;
  q?: string;
  serviceId?: string;
  status?: RateCardStatus;
  segmentKey?: string;
}

export interface ListRateCardsRecord {
  organizationId: string;
  page: number;
  pageSize: number;
  q?: string;
  serviceId?: string;
  status?: RateCardStatus;
  segmentKey?: string;
}

export interface RateCardListResult {
  items: RateCardRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface CreateRateCardInput {
  serviceId: string;
  name: string;
  segmentKey: string;
  segmentName: string;
  calculationType: RateCalculationType;
}

export interface CreateRateCardRecord {
  organizationId: string;
  serviceId: string;
  name: string;
  segmentKey: string;
  segmentName: string;
  calculationType: RateCalculationType;
  currencyCode: string;
  weightUnit: 'LB' | 'KG';
}

export interface UpdateRateCardInput {
  serviceId?: string;
  name?: string;
  segmentKey?: string;
  segmentName?: string;
  calculationType?: RateCalculationType;
}

export interface UpdateRateCardRecord {
  organizationId: string;
  rateCardId: string;
  serviceId?: string;
  name?: string;
  segmentKey?: string;
  segmentName?: string;
  calculationType?: RateCalculationType;
  currencyCode: string;
  weightUnit: 'LB' | 'KG';
}

export interface ReplaceRateRuleInput {
  sortOrder?: number;
  minWeight?: number | null;
  maxWeight?: number | null;
  flatAmountMinor?: number | null;
  unitAmountMinor?: number | null;
}

export interface ReplaceRateRulesInput {
  rules: ReplaceRateRuleInput[];
}

export interface ReplaceRateRuleRecord {
  sortOrder: number;
  minWeight: string | null;
  maxWeight: string | null;
  flatAmountMinor: bigint | null;
  unitAmountMinor: bigint | null;
}

export interface ReplaceRateRulesRecord {
  organizationId: string;
  rateCardId: string;
  rules: ReplaceRateRuleRecord[];
  currencyCode: string;
  weightUnit: 'LB' | 'KG';
}

export interface RateQuoteInput {
  rateCardId: string;
  weight: number;
  pieceCount?: number;
  customsAmountMinor?: number;
}

export interface RateQuoteRecord {
  rateCard: RateCardRecord;
  appliedRule: RateRuleRecord;
  weight: string;
  pieceCount: number;
  courierAmountMinor: bigint;
  customsAmountMinor: bigint;
  totalAmountMinor: bigint;
}

export interface RatesRepositoryContext {
  context?: CommandContext;
}
