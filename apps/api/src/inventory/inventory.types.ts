import type { CommandContext } from '../request-context/request-context.types';

export const WAREHOUSE_LOCATION_TYPE_VALUES = [
  'RECEIVING',
  'SHELF',
  'RACK',
  'BIN',
  'STAGING',
  'HOLD',
  'DISPATCH',
] as const;

export const INVENTORY_MOVEMENT_TYPE_VALUES = [
  'PUTAWAY',
  'MOVE',
  'HOLD',
  'RELEASE',
  'REMOVE',
] as const;

export type WarehouseLocationType =
  (typeof WAREHOUSE_LOCATION_TYPE_VALUES)[number];
export type InventoryMovementType =
  (typeof INVENTORY_MOVEMENT_TYPE_VALUES)[number];

export interface WarehouseLocationRecord {
  id: string;
  organizationId: string;
  facility: {
    id: string;
    code: string;
    name: string;
  };
  code: string;
  name: string;
  type: WarehouseLocationType;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWarehouseLocationInput {
  facilityId: string;
  code: string;
  name: string;
  type: WarehouseLocationType;
  description?: string | null;
  isActive?: boolean;
}

export interface CreateWarehouseLocationRecord {
  organizationId: string;
  facilityId: string;
  code: string;
  name: string;
  type: WarehouseLocationType;
  description: string | null;
  isActive: boolean;
}

export interface UpdateWarehouseLocationInput {
  code?: string;
  name?: string;
  type?: WarehouseLocationType;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateWarehouseLocationRecord {
  organizationId: string;
  locationId: string;
  code?: string;
  name?: string;
  type?: WarehouseLocationType;
  description?: string | null;
  isActive?: boolean;
}

export interface ListWarehouseLocationsInput {
  page?: number;
  pageSize?: number;
  q?: string;
  facilityId?: string;
  type?: WarehouseLocationType;
  isActive?: boolean;
}

export interface ListWarehouseLocationsRecord {
  organizationId: string;
  page: number;
  pageSize: number;
  q?: string;
  facilityId?: string;
  type?: WarehouseLocationType;
  isActive?: boolean;
}

export interface WarehouseLocationListResult {
  items: WarehouseLocationRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface InventoryPackageRecord {
  id: string;
  internalTrackingNumber: string;
  externalTrackingNumber: string;
  status:
    | 'RECEPTION_PENDING'
    | 'RECEIVED_AT_ORIGIN'
    | 'IN_TRANSIT'
    | 'ARRIVED_AT_DESTINATION'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'CANCELLED';
  customer: {
    id: string;
    customerCode: string;
    displayName: string;
  };
  reception: {
    facility: {
      id: string;
      code: string;
      name: string;
    };
    receivedAt: Date;
  };
  currentPosition: {
    location: {
      id: string;
      code: string;
      name: string;
      type: WarehouseLocationType;
    };
    placedAt: Date;
    updatedAt: Date;
  } | null;
}

export interface ListInventoryPackagesInput {
  page?: number;
  pageSize?: number;
  q?: string;
  facilityId?: string;
  locationId?: string;
}

export interface ListInventoryPackagesRecord {
  organizationId: string;
  page: number;
  pageSize: number;
  q?: string;
  facilityId?: string;
  locationId?: string;
}

export interface InventoryPackageListResult {
  items: InventoryPackageRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface MoveInventoryPackageInput {
  movementType: InventoryMovementType;
  toLocationId?: string | null;
  note?: string | null;
}

export interface MoveInventoryPackageRecord {
  organizationId: string;
  packageId: string;
  movedByEmployeeId: string;
  movementType: InventoryMovementType;
  toLocationId: string | null;
  note: string | null;
}

export interface InventoryMovementRecord {
  id: string;
  packageId: string;
  facility: {
    id: string;
    code: string;
    name: string;
  };
  movementType: InventoryMovementType;
  fromLocation: {
    id: string;
    code: string;
    name: string;
    type: WarehouseLocationType;
  } | null;
  toLocation: {
    id: string;
    code: string;
    name: string;
    type: WarehouseLocationType;
  } | null;
  movedBy: {
    id: string;
    displayName: string;
  };
  note: string | null;
  occurredAt: Date;
  createdAt: Date;
}

export interface InventoryRepositoryContext {
  context?: CommandContext;
}
