abstract class RatesError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidRatesInputError extends RatesError {
  readonly code = 'RATES_INVALID_INPUT';

  constructor(message: string) {
    super(message);
  }
}

export class CourierServiceNotFoundError extends RatesError {
  readonly code = 'COURIER_SERVICE_NOT_FOUND';

  constructor(serviceId: string) {
    super(`Courier service not found: ${serviceId}`);
  }
}

export class CourierServiceCodeConflictError extends RatesError {
  readonly code = 'COURIER_SERVICE_CODE_CONFLICT';

  constructor(code: string) {
    super(`Courier service code conflict: ${code}`);
  }
}

export class CourierServiceUnavailableError extends RatesError {
  readonly code = 'COURIER_SERVICE_UNAVAILABLE';

  constructor(message: string) {
    super(message);
  }
}

export class RateCardNotFoundError extends RatesError {
  readonly code = 'RATE_CARD_NOT_FOUND';

  constructor(rateCardId: string) {
    super(`Rate card not found: ${rateCardId}`);
  }
}

export class RateCardConflictError extends RatesError {
  readonly code = 'RATE_CARD_CONFLICT';

  constructor(message: string) {
    super(message);
  }
}

export class RateQuoteConflictError extends RatesError {
  readonly code = 'RATE_QUOTE_CONFLICT';

  constructor(message: string) {
    super(message);
  }
}
