import type {
  ConsumeLoginChallengeRecordInput,
  CreateLoginChallengeRecordInput,
  LoginChallengeConsumeRecordResult,
} from './login-challenge.types';

export abstract class LoginChallengesRepository {
  abstract createLoginChallengeRecord(
    input: CreateLoginChallengeRecordInput,
  ): Promise<void>;

  abstract consumeLoginChallengeRecord(
    input: ConsumeLoginChallengeRecordInput,
  ): Promise<LoginChallengeConsumeRecordResult>;
}
