import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class AddPackagesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(4, { each: true })
  packageIds!: string[];
}
