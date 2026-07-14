import type { CommandContext } from '../request-context/request-context.types';
import type {
  CompletePackageDocumentRecord,
  CreatePackageDocumentRecord,
  DeletePackageDocumentRecord,
  PackageDocumentRecord,
  PackageDocumentStorageReference,
} from './package-document.types';

export abstract class PackageDocumentsRepository {
  abstract createPending(
    input: CreatePackageDocumentRecord,
    context: CommandContext,
  ): Promise<PackageDocumentRecord>;

  abstract listByPackage(
    organizationId: string,
    packageId: string,
  ): Promise<PackageDocumentRecord[]>;

  abstract findStorageReference(
    organizationId: string,
    packageId: string,
    documentId: string,
  ): Promise<PackageDocumentStorageReference | null>;

  abstract completeUpload(
    input: CompletePackageDocumentRecord,
    context: CommandContext,
  ): Promise<PackageDocumentRecord | null>;

  abstract markQuarantined(
    organizationId: string,
    packageId: string,
    documentId: string,
    context: CommandContext,
  ): Promise<void>;

  abstract markDeleted(
    input: DeletePackageDocumentRecord,
    context: CommandContext,
  ): Promise<PackageDocumentRecord | null>;
}
