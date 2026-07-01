import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';

export class ReplaceEmployeeFacilitiesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  facilityIds!: string[];

  @IsOptional()
  @IsUUID('4')
  primaryFacilityId?: string;
}
