import { IsString, MinLength } from 'class-validator';

export class ReleaseHoldDto {
  @IsString()
  @MinLength(5)
  releaseReason!: string;
}
