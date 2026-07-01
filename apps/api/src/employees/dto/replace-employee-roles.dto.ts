import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class ReplaceEmployeeRolesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  roleIds!: string[];
}
