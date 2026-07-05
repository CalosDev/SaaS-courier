import type { CommandContext } from '../request-context/request-context.types';
import type {
  CreateManualPackageRecord,
  CreatePackageFromPrealertRecord,
  ListPackagesRecord,
  PackageListResult,
  PackageRecord,
  UpdatePackageRecord,
} from './package.types';

export abstract class PackagesRepository {
  abstract createManual(
    input: CreateManualPackageRecord,
    context?: CommandContext,
  ): Promise<PackageRecord>;

  abstract createFromPrealert(
    input: CreatePackageFromPrealertRecord,
    context?: CommandContext,
  ): Promise<PackageRecord>;

  abstract findById(
    organizationId: string,
    packageId: string,
  ): Promise<PackageRecord | null>;

  abstract list(input: ListPackagesRecord): Promise<PackageListResult>;

  abstract update(
    input: UpdatePackageRecord,
    context?: CommandContext,
  ): Promise<PackageRecord | null>;

  abstract cancel(
    organizationId: string,
    packageId: string,
    reason: string,
    context?: CommandContext,
  ): Promise<PackageRecord | null>;
}
