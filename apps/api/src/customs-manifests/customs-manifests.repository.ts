import { CreateCustomsManifestDto } from './dto/create-customs-manifest.dto';
import { UpdateCustomsManifestDto } from './dto/update-customs-manifest.dto';
import {
  CustomsManifestDetailRecord,
  CustomsManifestRecord,
} from './customs-manifest.types';
import { CustomsManifestStatus, Prisma } from '../generated/prisma/client';

export const CustomsManifestsRepositoryToken = Symbol(
  'CustomsManifestsRepository',
);

export interface CustomsManifestsRepository {
  findMany(organizationId: string): Promise<CustomsManifestRecord[]>;

  create(
    organizationId: string,
    code: string,
    dto: CreateCustomsManifestDto,
    tx?: Prisma.TransactionClient,
  ): Promise<CustomsManifestRecord>;

  findById(
    organizationId: string,
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<CustomsManifestRecord | null>;

  findDetailById(
    organizationId: string,
    id: string,
  ): Promise<CustomsManifestDetailRecord | null>;

  findByCode(
    organizationId: string,
    code: string,
  ): Promise<CustomsManifestRecord | null>;

  update(
    organizationId: string,
    id: string,
    dto: UpdateCustomsManifestDto,
    tx?: Prisma.TransactionClient,
  ): Promise<CustomsManifestRecord>;

  addPackages(
    organizationId: string,
    manifestId: string,
    packageIds: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<void>;

  removePackages(
    organizationId: string,
    manifestId: string,
    packageIds: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<void>;

  updateStatus(
    organizationId: string,
    id: string,
    status: CustomsManifestStatus,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
}
