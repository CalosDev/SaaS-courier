import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class BatchPutawayDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MinLength(3, { each: true })
  @MaxLength(100, { each: true })
  codes!: string[];

  @IsUUID('4')
  toLocationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
