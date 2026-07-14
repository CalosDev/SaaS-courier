import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const AUTHORIZED_CARRIERS = ['UPS', 'FEDEX', 'DHL'] as const;

export class CreateCarrierConnectionDto {
  @IsString()
  @IsIn(AUTHORIZED_CARRIERS)
  carrierCode!: (typeof AUTHORIZED_CARRIERS)[number];

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;

  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{2,119}$/)
  secretReference!: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';
}
