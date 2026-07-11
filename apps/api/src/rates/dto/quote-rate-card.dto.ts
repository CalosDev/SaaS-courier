import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class QuoteRateCardDto {
  @IsUUID('4')
  rateCardId!: string;

  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(1_000_000)
  weight!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  pieceCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  customsAmountMinor?: number;
}
