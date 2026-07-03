import type { CommandContext } from '../request-context/request-context.types';
import type {
  CreatePrealertRecord,
  ListPrealertsRecord,
  PrealertListResult,
  PrealertRecord,
  UpdatePrealertRecord,
} from './prealert.types';

export abstract class PrealertsRepository {
  abstract create(
    input: CreatePrealertRecord,
    context?: CommandContext,
  ): Promise<PrealertRecord>;
  abstract findById(
    organizationId: string,
    prealertId: string,
  ): Promise<PrealertRecord | null>;
  abstract list(input: ListPrealertsRecord): Promise<PrealertListResult>;
  abstract update(
    input: UpdatePrealertRecord,
    context?: CommandContext,
  ): Promise<PrealertRecord | null>;
  abstract cancel(
    organizationId: string,
    prealertId: string,
    reason: string,
    context?: CommandContext,
  ): Promise<PrealertRecord | null>;
}
