import { IsEnum, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

import {
  PACKAGE_DOCUMENT_TYPE_VALUES,
  type PackageDocumentType,
} from '../package-document.types';

export class CreatePackageDocumentUploadIntentDto {
  @IsEnum(PACKAGE_DOCUMENT_TYPE_VALUES)
  documentType!: PackageDocumentType;

  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(120)
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(25 * 1024 * 1024)
  contentLength!: number;
}
