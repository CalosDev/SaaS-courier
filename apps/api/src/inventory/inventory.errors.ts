abstract class InventoryError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidInventoryInputError extends InventoryError {
  readonly code = 'INVENTORY_INVALID_INPUT';

  constructor(message: string) {
    super(message);
  }
}

export class WarehouseLocationNotFoundError extends InventoryError {
  readonly code = 'WAREHOUSE_LOCATION_NOT_FOUND';

  constructor(locationId: string) {
    super(`Warehouse location not found: ${locationId}`);
  }
}

export class WarehouseLocationCodeConflictError extends InventoryError {
  readonly code = 'WAREHOUSE_LOCATION_CODE_CONFLICT';

  constructor(code: string) {
    super(`Warehouse location code already exists: ${code}`);
  }
}

export class WarehouseLocationUnavailableError extends InventoryError {
  readonly code = 'WAREHOUSE_LOCATION_UNAVAILABLE';

  constructor(message: string) {
    super(message);
  }
}

export class InventoryMovementConflictError extends InventoryError {
  readonly code = 'INVENTORY_MOVEMENT_CONFLICT';

  constructor(message: string) {
    super(message);
  }
}
