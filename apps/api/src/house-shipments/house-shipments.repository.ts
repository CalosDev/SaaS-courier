import { CreateHouseShipmentDto } from './dto/create-house-shipment.dto';
import { UpdateHouseShipmentDto } from './dto/update-house-shipment.dto';
import { HouseShipmentRecord } from './house-shipment.types';

export abstract class HouseShipmentsRepository {
  abstract create(
    organizationId: string,
    dispatchId: string,
    dto: CreateHouseShipmentDto,
  ): Promise<HouseShipmentRecord>;

  abstract findById(
    organizationId: string,
    id: string,
  ): Promise<HouseShipmentRecord | null>;

  abstract findByDispatchId(
    organizationId: string,
    dispatchId: string,
  ): Promise<HouseShipmentRecord[]>;

  abstract update(
    organizationId: string,
    id: string,
    dto: UpdateHouseShipmentDto,
  ): Promise<HouseShipmentRecord>;

  abstract addPackages(
    organizationId: string,
    id: string,
    packageIds: string[],
  ): Promise<void>;

  abstract removePackages(
    organizationId: string,
    id: string,
    packageIds: string[],
  ): Promise<void>;

  abstract updateStatus(
    organizationId: string,
    id: string,
    status: 'CLOSED' | 'CANCELLED',
  ): Promise<void>;
}
