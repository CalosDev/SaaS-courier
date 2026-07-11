import type { CommandContext } from '../request-context/request-context.types';
import type {
  CourierServiceListResult,
  CourierServiceRecord,
  CreateCourierServiceRecord,
  CreateRateCardRecord,
  ListCourierServicesRecord,
  ListRateCardsRecord,
  RateCardListResult,
  RateCardRecord,
  ReplaceRateRulesRecord,
  UpdateCourierServiceRecord,
  UpdateRateCardRecord,
} from './rates.types';

export abstract class RatesRepository {
  abstract listServices(
    input: ListCourierServicesRecord,
  ): Promise<CourierServiceListResult>;

  abstract findServiceById(
    organizationId: string,
    serviceId: string,
  ): Promise<CourierServiceRecord | null>;

  abstract createService(
    input: CreateCourierServiceRecord,
    context?: CommandContext,
  ): Promise<CourierServiceRecord>;

  abstract updateService(
    input: UpdateCourierServiceRecord,
    context?: CommandContext,
  ): Promise<CourierServiceRecord | null>;

  abstract listRateCards(
    input: ListRateCardsRecord,
  ): Promise<RateCardListResult>;

  abstract findRateCardById(
    organizationId: string,
    rateCardId: string,
  ): Promise<RateCardRecord | null>;

  abstract createRateCard(
    input: CreateRateCardRecord,
    context?: CommandContext,
  ): Promise<RateCardRecord>;

  abstract updateRateCard(
    input: UpdateRateCardRecord,
    context?: CommandContext,
  ): Promise<RateCardRecord | null>;

  abstract replaceRateRules(
    input: ReplaceRateRulesRecord,
    context?: CommandContext,
  ): Promise<RateCardRecord | null>;

  abstract activateRateCard(
    organizationId: string,
    rateCardId: string,
    context: CommandContext,
  ): Promise<RateCardRecord | null>;
}
