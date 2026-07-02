import { Injectable } from '@nestjs/common';
import type { PlanCatalogRecord } from './organization-settings.types';

const PLAN_CATALOG: Record<string, PlanCatalogRecord> = Object.freeze({
  PILOT: Object.freeze({
    code: 'PILOT',
    modules: Object.freeze([
      'organizations',
      'facilities',
      'employees',
      'roles',
      'customers',
      'onboarding',
      'customer_imports',
    ]),
  }),
});

@Injectable()
export class PlanCatalogService {
  getPlan(planCode: string): PlanCatalogRecord {
    return PLAN_CATALOG[planCode] ?? PLAN_CATALOG.PILOT;
  }
}
