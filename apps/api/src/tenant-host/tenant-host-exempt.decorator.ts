import { SetMetadata } from '@nestjs/common';

export const IS_TENANT_HOST_EXEMPT = 'isTenantHostExempt';

export const TenantHostExempt = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_TENANT_HOST_EXEMPT, true);
