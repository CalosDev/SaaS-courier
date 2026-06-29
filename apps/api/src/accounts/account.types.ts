export type UserAccountStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';

export interface UserAccountRecord {
  id: string;
  email: string;
  status: UserAccountStatus;
  emailVerifiedAt: Date | null;
  passwordChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface InviteUserInput {
  email: string;
}

export interface ActivationTokenSecret {
  token: string;
  tokenHash: string;
}

export type ActivationTokenValue = string;

export interface CreateInvitedUserRecord {
  email: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface InvitedUserRecord {
  user: UserAccountRecord;
  expiresAt: Date;
}

export interface InviteUserResult {
  user: UserAccountRecord;
  activationToken: string;
  expiresAt: Date;
}

export interface ActivateAccountInput {
  activationToken: string;
  password: string;
}

export interface ActivateAccountRecord {
  tokenHash: string;
  passwordHash: string;
  activatedAt: Date;
}
