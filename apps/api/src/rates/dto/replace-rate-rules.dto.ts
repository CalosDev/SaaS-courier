import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReplaceRateRuleDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  sortOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 3 })
  @Min(0)
  minWeight?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 3 })
  @Min(0)
  maxWeight?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  flatAmountMinor?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unitAmountMinor?: number | null;
}

export class ReplaceRateRulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReplaceRateRuleDto)
  rules!: ReplaceRateRuleDto[];
}
