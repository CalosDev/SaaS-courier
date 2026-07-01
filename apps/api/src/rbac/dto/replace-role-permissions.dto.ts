import { IsArray, IsString, MaxLength } from 'class-validator';

export class ReplaceRolePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  permissionCodes!: string[];
}
