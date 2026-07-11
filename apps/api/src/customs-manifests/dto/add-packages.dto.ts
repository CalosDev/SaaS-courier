import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class AddPackagesToCustomsManifestDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  packageIds!: string[];
}
