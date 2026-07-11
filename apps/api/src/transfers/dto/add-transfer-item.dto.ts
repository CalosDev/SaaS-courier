import { IsNotEmpty, IsUUID } from 'class-validator';

export class AddTransferItemDto {
  @IsUUID()
  @IsNotEmpty()
  packageId!: string;
}
