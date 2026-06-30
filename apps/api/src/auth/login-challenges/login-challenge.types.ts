export interface CreateLoginChallengeInput {
  userId: string;
}

export interface ConsumeLoginChallengeInput {
  challengeToken: string;
}

export interface LoginChallengeTokenSecret {
  token: string;
  tokenHash: string;
}

export interface CreatedLoginChallengeResult {
  token: string;
  expiresAt: Date;
}

export interface ConsumedLoginChallengeResult {
  userId: string;
}

export interface CreateLoginChallengeRecordInput {
  challengeId: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  invalidatedAt: Date;
}

export interface ConsumeLoginChallengeRecordInput {
  tokenHash: string;
  consumedAt: Date;
}

export type LoginChallengeConsumeRecordResult =
  | {
      status: 'consumed';
      userId: string;
    }
  | {
      status: 'invalid';
    };
