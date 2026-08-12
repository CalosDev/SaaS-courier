import type { Request } from 'express';

import type { SessionContext } from '../../sessions/session.types';
import type { TenantHostContext } from '../../tenant-host/tenant-host.types';

export interface AuthenticatedRequest extends Request {
  auth?: SessionContext;
  tenantHost?: TenantHostContext;
}
