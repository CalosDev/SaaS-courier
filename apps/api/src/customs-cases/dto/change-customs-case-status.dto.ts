import { CustomsCaseStatus } from '../../generated/prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeCustomsCaseStatusDto {
  @IsEnum(CustomsCaseStatus)
  status!: CustomsCaseStatus;
}
