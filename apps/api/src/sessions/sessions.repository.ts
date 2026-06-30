import type {
  CreateSessionRecordInput,
  RevokeAllUserSessionsRecordInput,
  RevokeSessionRecordInput,
  RotateSessionRecordInput,
  SessionPrincipalContext,
  SessionRotationRecord,
  SessionValidationRecord,
  ValidateSessionRecordInput,
} from './session.types';

export abstract class SessionsRepository {
  abstract findSessionCreationContext(
    userId: string,
    organizationId: string,
  ): Promise<SessionPrincipalContext | null>;

  abstract createSessionRecord(
    input: CreateSessionRecordInput,
  ): Promise<import('./session.types').SessionContext>;

  abstract validateSessionRecord(
    input: ValidateSessionRecordInput,
  ): Promise<SessionValidationRecord>;

  abstract rotateSessionRecord(
    input: RotateSessionRecordInput,
  ): Promise<SessionRotationRecord>;

  abstract revokeSessionRecord(input: RevokeSessionRecordInput): Promise<void>;

  abstract revokeAllUserSessionsRecord(
    input: RevokeAllUserSessionsRecordInput,
  ): Promise<number>;
}
