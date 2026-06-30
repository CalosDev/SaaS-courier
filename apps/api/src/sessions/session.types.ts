export type SessionRevocationReason =
  | 'LOGOUT'
  | 'ROTATED'
  | 'REUSE_DETECTED'
  | 'IDLE_TIMEOUT'
  | 'ADMIN_REVOKED'
  | 'ACCOUNT_CHANGED';

export type AdministrativeSessionRevocationReason =
  | 'ADMIN_REVOKED'
  | 'ACCOUNT_CHANGED';

export interface CreateSessionInput {
  userId: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ValidateSessionInput {
  sessionToken: string;
}

export interface RotateSessionInput {
  sessionToken: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RevokeSessionInput {
  sessionToken: string;
}

export interface RevokeAllUserSessionsInput {
  userId: string;
  reason: AdministrativeSessionRevocationReason;
}

export interface SessionTokenSecret {
  token: string;
  tokenHash: string;
}

export interface SessionPrincipalContext {
  userId: string;
  email: string;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  facilityIds: string[];
  employeeCode?: string;
  primaryFacilityId?: string;
}

export interface SessionContext extends SessionPrincipalContext {
  sessionId: string;
  expiresAt: Date;
}

export interface CreatedSessionResult {
  sessionToken: string;
  session: SessionContext;
}

export interface RotatedSessionResult {
  sessionToken: string;
  session: SessionContext;
}

export interface CreateSessionRecordInput {
  sessionId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  lastSeenAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  principal: SessionPrincipalContext;
}

export interface ValidateSessionRecordInput {
  tokenHash: string;
  evaluatedAt: Date;
  idleExpiresBefore: Date;
  refreshLastSeenBefore: Date;
}

export type SessionValidationRecord =
  | {
      status: 'valid';
      session: SessionContext;
    }
  | {
      status: 'invalid';
    }
  | {
      status: 'reuse-detected';
    };

export interface RotateSessionRecordInput {
  currentTokenHash: string;
  newSessionId: string;
  newTokenHash: string;
  rotatedAt: Date;
  idleExpiresBefore: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

export type SessionRotationRecord =
  | {
      status: 'rotated';
      session: SessionContext;
    }
  | {
      status: 'invalid';
    }
  | {
      status: 'reuse-detected';
    };

export interface RevokeSessionRecordInput {
  tokenHash: string;
  revokedAt: Date;
  reason: 'LOGOUT';
}

export interface RevokeAllUserSessionsRecordInput {
  userId: string;
  revokedAt: Date;
  reason: AdministrativeSessionRevocationReason;
}
