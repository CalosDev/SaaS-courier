import type { AuthenticatedRequest } from '../auth/http/authenticated-request.type';

export type CommandActorType = 'EMPLOYEE' | 'SYSTEM' | 'INTEGRATION';
export type CommandSource = 'HTTP' | 'JOB' | 'IMPORT' | 'SYSTEM';

export interface RequestMetadata {
  requestId: string;
  correlationId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface CommandContext extends RequestMetadata {
  organizationId: string;
  actorType: CommandActorType;
  actorUserId: string | null;
  actorEmployeeId: string | null;
  source: CommandSource;
}

export interface RequestWithMetadata extends AuthenticatedRequest {
  requestMetadata: RequestMetadata;
}
