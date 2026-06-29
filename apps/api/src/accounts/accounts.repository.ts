import type {
  ActivateAccountRecord,
  CreateInvitedUserRecord,
  InvitedUserRecord,
  UserAccountRecord,
} from './account.types';

export abstract class AccountsRepository {
  abstract inviteUser(
    input: CreateInvitedUserRecord,
  ): Promise<InvitedUserRecord>;

  abstract activateAccount(
    input: ActivateAccountRecord,
  ): Promise<UserAccountRecord>;
}
