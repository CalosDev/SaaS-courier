import { CreateCustomsManifestDto } from './dto/create-customs-manifest.dto';
import { UpdateCustomsManifestDto } from './dto/update-customs-manifest.dto';
import { CustomsManifestRecord } from './customs-manifest.types';
import { CustomsManifestStatus } from '../generated/prisma/client';

export const CustomsManifestsRepositoryToken = Symbol(
  'CustomsManifestsRepository',
);

export interface CustomsManifestsRepository {
  findMany(organizationId: string): Promise<CustomsManifestRecord[]>;

  create(
    organizationId: string,
    code: string,
    dto: CreateCustomsManifestDto,
  ): Promise<CustomsManifestRecord>;

  findById(
    organizationId: string,
    id: string,
  ): Promise<CustomsManifestRecord | null>;

  findByCode(
    organizationId: string,
    code: string,
  ): Promise<CustomsManifestRecord | null>;

  update(
    organizationId: string,
    id: string,
    dto: UpdateCustomsManifestDto,
  ): Promise<CustomsManifestRecord>;

  addPackages(
    organizationId: string,
    manifestId: string,
    packageIds: string[],
  ): Promise<void>;

  removePackages(
    organizationId: string,
    manifestId: string,
    packageIds: string[],
  ): Promise<void>;

  updateStatus(
    organizationId: string,
    id: string,
    status: CustomsManifestStatus,
  ): Promise<void>;
}
