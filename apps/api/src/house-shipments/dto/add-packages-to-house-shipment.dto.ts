import { IsArray, IsUUID } from 'class-validator';

export class AddPackagesToHouseShipmentDto {
  @IsArray()
  @IsUUID('4', { each: true })
  packageIds: string[];
}
