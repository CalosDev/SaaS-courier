import type { Request } from 'express';

import type { SessionContext } from '../../sessions/session.types';

export interface AuthenticatedRequest extends Request {
  auth?: SessionContext;
}
