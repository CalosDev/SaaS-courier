import type { CommandContext } from '../request-context/request-context.types';
import type {
  CreateWarehouseLocationRecord,
  InventoryMovementRecord,
  InventoryPackageListResult,
  InventoryPackageRecord,
  ListInventoryPackagesRecord,
  ListWarehouseLocationsRecord,
  MoveInventoryPackageRecord,
  UpdateWarehouseLocationRecord,
  WarehouseLocationListResult,
  WarehouseLocationRecord,
} from './inventory.types';

export abstract class InventoryRepository {
  abstract listLocations(
    input: ListWarehouseLocationsRecord,
  ): Promise<WarehouseLocationListResult>;

  abstract createLocation(
    input: CreateWarehouseLocationRecord,
    context: CommandContext,
  ): Promise<WarehouseLocationRecord>;

  abstract updateLocation(
    input: UpdateWarehouseLocationRecord,
    context: CommandContext,
  ): Promise<WarehouseLocationRecord | null>;

  abstract listPackages(
    input: ListInventoryPackagesRecord,
  ): Promise<InventoryPackageListResult>;

  abstract movePackage(
    input: MoveInventoryPackageRecord,
    context: CommandContext,
  ): Promise<InventoryPackageRecord | null>;

  abstract listPackageMovements(
    organizationId: string,
    packageId: string,
  ): Promise<InventoryMovementRecord[]>;
}
