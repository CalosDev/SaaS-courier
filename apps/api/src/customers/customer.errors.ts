abstract class CustomerError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidCustomerInputError extends CustomerError {
  readonly code = 'CUSTOMER_INVALID_INPUT';

  constructor(message: string) {
    super(message);
  }
}

export class CustomerNotFoundError extends CustomerError {
  readonly code = 'CUSTOMER_NOT_FOUND';

  constructor(customerId: string) {
    super(`Customer not found: ${customerId}`);
  }
}

export class CustomerCodeGenerationError extends CustomerError {
  readonly code = 'CUSTOMER_CODE_GENERATION_FAILED';

  constructor() {
    super('Customer code generation failed');
  }
}

export class CustomerAddressNotFoundError extends CustomerError {
  readonly code = 'CUSTOMER_ADDRESS_NOT_FOUND';

  constructor(addressId: string) {
    super(`Customer address not found: ${addressId}`);
  }
}

export class CustomerIdentityConflictError extends CustomerError {
  readonly code = 'CUSTOMER_IDENTITY_CONFLICT';

  constructor(documentType: string, documentNumber: string) {
    super(
      `Customer identity already exists: ${documentType}:${documentNumber}`,
    );
  }
}

export class CustomerCustomsProfileNotFoundError extends CustomerError {
  readonly code = 'CUSTOMER_CUSTOMS_PROFILE_NOT_FOUND';

  constructor(customerId: string) {
    super(`Customer customs profile not found: ${customerId}`);
  }
}

export class InvalidCustomerCustomsProfileError extends CustomerError {
  readonly code = 'CUSTOMER_CUSTOMS_PROFILE_INVALID';

  constructor(message: string) {
    super(message);
  }
}
