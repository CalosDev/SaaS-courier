import { Inject, Injectable } from '@nestjs/common';

import { PackageNotFoundError } from '../packages/package.errors';
import { PackagesService } from '../packages/packages.service';
import type { CommandContext } from '../request-context/request-context.types';
import {
  InvalidInventoryInputError,
  WarehouseLocationNotFoundError,
} from './inventory.errors';
import { InventoryRepository } from './inventory.repository';
import type {
  CreateWarehouseLocationInput,
  InventoryMovementRecord,
  InventoryPackageListResult,
  InventoryPackageRecord,
  ListInventoryPackagesInput,
  ListWarehouseLocationsInput,
  MoveInventoryPackageInput,
  UpdateWarehouseLocationInput,
  WarehouseLocationListResult,
  WarehouseLocationRecord,
  WarehouseLocationType,
} from './inventory.types';
import {
  INVENTORY_MOVEMENT_TYPE_VALUES,
  WAREHOUSE_LOCATION_TYPE_VALUES,
} from './inventory.types';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const LOCATION_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,39}$/;

@Injectable()
export class InventoryService {
  constructor(
    @Inject(InventoryRepository)
    private readonly inventoryRepository: InventoryRepository,
    private readonly packagesService: PackagesService,
  ) {}

  listLocations(
    organizationId: string,
    input: ListWarehouseLocationsInput,
  ): Promise<WarehouseLocationListResult> {
    return this.inventoryRepository.listLocations({
      organizationId: this.requiredText(organizationId, 'organizationId'),
      page: this.page(input.page),
      pageSize: this.pageSize(input.pageSize),
      q: this.optionalText(input.q) ?? undefined,
      facilityId: this.optionalUuid(input.facilityId, 'facilityId'),
      type:
        input.type !== undefined
          ? this.locationType(input.type, 'type')
          : undefined,
      isActive: input.isActive,
    });
  }

  async createLocation(
    organizationId: string,
    input: CreateWarehouseLocationInput,
    context?: CommandContext,
  ): Promise<WarehouseLocationRecord> {
    const normalizedOrganizationId = this.requiredText(
      organizationId,
      'organizationId',
    );

    return this.inventoryRepository.createLocation(
      {
        organizationId: normalizedOrganizationId,
        facilityId: this.requiredText(input.facilityId, 'facilityId'),
        code: this.locationCode(input.code),
        name: this.locationName(input.name),
        type: this.locationType(input.type, 'type'),
        description: this.optionalLongText(input.description),
        isActive: input.isActive ?? true,
      },
      this.commandContext(context, normalizedOrganizationId),
    );
  }

  async updateLocation(
    organizationId: string,
    locationId: string,
    input: UpdateWarehouseLocationInput,
    context?: CommandContext,
  ): Promise<WarehouseLocationRecord> {
    const normalizedOrganizationId = this.requiredText(
      organizationId,
      'organizationId',
    );
    const record = {
      organizationId: normalizedOrganizationId,
      locationId: this.requiredText(locationId, 'locationId'),
      ...(input.code !== undefined
        ? { code: this.locationCode(input.code) }
        : {}),
      ...(input.name !== undefined
        ? { name: this.locationName(input.name) }
        : {}),
      ...(input.type !== undefined
        ? { type: this.locationType(input.type, 'type') }
        : {}),
      ...(input.description !== undefined
        ? { description: this.optionalLongText(input.description) }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    };

    if (Object.keys(record).length === 2) {
      throw new InvalidInventoryInputError(
        'Invalid inventory input: at least one field is required',
      );
    }

    const updated = await this.inventoryRepository.updateLocation(
      record,
      this.commandContext(context, normalizedOrganizationId),
    );

    if (!updated) {
      throw new WarehouseLocationNotFoundError(locationId);
    }

    return updated;
  }

  listPackages(
    organizationId: string,
    input: ListInventoryPackagesInput,
  ): Promise<InventoryPackageListResult> {
    return this.inventoryRepository.listPackages({
      organizationId: this.requiredText(organizationId, 'organizationId'),
      page: this.page(input.page),
      pageSize: this.pageSize(input.pageSize),
      q: this.optionalText(input.q) ?? undefined,
      facilityId: this.optionalUuid(input.facilityId, 'facilityId'),
      locationId: this.optionalUuid(input.locationId, 'locationId'),
    });
  }

  async movePackage(
    organizationId: string,
    packageId: string,
    input: MoveInventoryPackageInput,
    context?: CommandContext,
  ): Promise<InventoryPackageRecord> {
    const normalizedOrganizationId = this.requiredText(
      organizationId,
      'organizationId',
    );
    const normalizedPackageId = this.requiredText(packageId, 'packageId');
    const commandContext = this.commandContext(
      context,
      normalizedOrganizationId,
    );

    await this.packagesService.getById(
      normalizedOrganizationId,
      normalizedPackageId,
    );

    const moved = await this.inventoryRepository.movePackage(
      {
        organizationId: normalizedOrganizationId,
        packageId: normalizedPackageId,
        movedByEmployeeId: this.requiredText(
          commandContext.actorEmployeeId,
          'actorEmployeeId',
        ),
        movementType: this.movementType(input.movementType),
        toLocationId:
          this.optionalUuid(input.toLocationId, 'toLocationId') ?? null,
        note: this.optionalLongText(input.note),
      },
      commandContext,
    );

    if (!moved) {
      throw new PackageNotFoundError(normalizedPackageId);
    }

    return moved;
  }

  async listPackageMovements(
    organizationId: string,
    packageId: string,
  ): Promise<InventoryMovementRecord[]> {
    const normalizedOrganizationId = this.requiredText(
      organizationId,
      'organizationId',
    );
    const normalizedPackageId = this.requiredText(packageId, 'packageId');

    await this.packagesService.getById(
      normalizedOrganizationId,
      normalizedPackageId,
    );

    return this.inventoryRepository.listPackageMovements(
      normalizedOrganizationId,
      normalizedPackageId,
    );
  }

  private page(value?: number): number {
    const page = value ?? DEFAULT_PAGE;

    if (!Number.isInteger(page) || page < 1) {
      throw new InvalidInventoryInputError(
        'Invalid inventory input: page must be a positive integer',
      );
    }

    return page;
  }

  private pageSize(value?: number): number {
    const pageSize = value ?? DEFAULT_PAGE_SIZE;

    if (
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > MAX_PAGE_SIZE
    ) {
      throw new InvalidInventoryInputError(
        'Invalid inventory input: pageSize is out of range',
      );
    }

    return pageSize;
  }

  private locationCode(value: string): string {
    const normalized = this.requiredText(value, 'code').toUpperCase();

    if (!LOCATION_CODE_PATTERN.test(normalized)) {
      throw new InvalidInventoryInputError(
        'Invalid inventory input: code format is invalid',
      );
    }

    return normalized;
  }

  private locationName(value: string): string {
    const normalized = this.requiredText(value, 'name');

    if (normalized.length < 2 || normalized.length > 120) {
      throw new InvalidInventoryInputError(
        'Invalid inventory input: name is invalid',
      );
    }

    return normalized;
  }

  private locationType(
    value: WarehouseLocationType,
    field: string,
  ): WarehouseLocationType {
    if (
      !(WAREHOUSE_LOCATION_TYPE_VALUES as readonly string[]).includes(value)
    ) {
      throw new InvalidInventoryInputError(
        `Invalid inventory input: ${field} is invalid`,
      );
    }

    return value;
  }

  private movementType(value: string) {
    if (
      !(INVENTORY_MOVEMENT_TYPE_VALUES as readonly string[]).includes(value)
    ) {
      throw new InvalidInventoryInputError(
        'Invalid inventory input: movementType is invalid',
      );
    }

    return value as MoveInventoryPackageInput['movementType'];
  }

  private optionalText(value?: string | null): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private optionalLongText(value?: string | null): string | null {
    const normalized = this.optionalText(value);

    if (normalized !== null && normalized.length > 500) {
      throw new InvalidInventoryInputError(
        'Invalid inventory input: note is too long',
      );
    }

    return normalized;
  }

  private optionalUuid(
    value: string | null | undefined,
    field: string,
  ): string | undefined {
    const normalized = this.optionalText(value);
    return normalized === null
      ? undefined
      : this.requiredText(normalized, field);
  }

  private requiredText(
    value: string | null | undefined,
    field: string,
  ): string {
    const normalized = typeof value === 'string' ? value.trim() : '';

    if (!normalized) {
      throw new InvalidInventoryInputError(
        `Invalid inventory input: ${field} is required`,
      );
    }

    return normalized;
  }

  private commandContext(
    context: CommandContext | undefined,
    organizationId: string,
  ): CommandContext {
    this.requiredText(context?.actorEmployeeId, 'actorEmployeeId');

    if (context?.organizationId !== organizationId) {
      throw new InvalidInventoryInputError(
        'Invalid inventory input: command context organization mismatch',
      );
    }

    return context;
  }
}
