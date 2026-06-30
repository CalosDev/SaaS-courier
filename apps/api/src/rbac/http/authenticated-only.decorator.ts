import { SetMetadata } from '@nestjs/common';

import { AUTHENTICATED_ONLY_KEY } from './authorization.constants';

export const AuthenticatedOnly = (): MethodDecorator & ClassDecorator =>
  SetMetadata(AUTHENTICATED_ONLY_KEY, true);
