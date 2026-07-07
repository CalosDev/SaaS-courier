import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsUUID, Max, Min } from 'class-validator';

import { PACKAGE_CONDITION_VALUES } from '../package-reception.types';

export class ReceivePackageDto {
  @IsUUID('4')
  facilityId!: string;

  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(100_000)
  weight!: number;

  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10_000)
  length!: number;

  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10_000)
  width!: number;

  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10_000)
  height!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  pieceCount!: number;

  @IsIn(PACKAGE_CONDITION_VALUES)
  condition!: (typeof PACKAGE_CONDITION_VALUES)[number];
}
