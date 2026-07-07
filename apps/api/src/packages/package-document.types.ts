import type { Readable } from 'node:stream';

import type { CommandContext } from '../request-context/request-context.types';

export const PACKAGE_DOCUMENT_TYPE_VALUES = [
  'INVOICE',
  'PURCHASE_RECEIPT',
  'PACKAGE_PHOTO',
  'DAMAGE_PHOTO',
  'IDENTITY_SUPPORT',
  'OTHER',
] as const;

export const STORED_OBJECT_STATUS_VALUES = [
  'PENDING_UPLOAD',
  'AVAILABLE',
  'QUARANTINED',
  'DELETED',
] as const;

export type PackageDocumentType = (typeof PACKAGE_DOCUMENT_TYPE_VALUES)[number];
export type StoredObjectStatus = (typeof STORED_OBJECT_STATUS_VALUES)[number];

export interface PackageDocumentEmployeeSummary {
  id: string;
  displayName: string;
}

export interface PackageDocumentRecord {
  id: string;
  packageId: string;
  documentType: PackageDocumentType;
  status: StoredObjectStatus;
  originalFilename: string;
  contentType: string;
  contentLength: number;
  createdBy: PackageDocumentEmployeeSummary;
  createdAt: Date;
  availableAt: Date | null;
  deletedAt: Date | null;
}

export interface PackageDocumentStorageReference extends PackageDocumentRecord {
  organizationId: string;
  bucketName: string;
  objectKey: string;
  etag: string | null;
}

export interface CreatePackageDocumentUploadIntentInput {
  documentType: PackageDocumentType;
  fileName: string;
  contentType: string;
  contentLength: number;
}

export interface CreatePackageDocumentRecord {
  organizationId: string;
  packageId: string;
  createdByEmployeeId: string;
  documentType: PackageDocumentType;
  bucketName: string;
  objectKey: string;
  originalFilename: string;
  contentType: string;
  contentLength: number;
}

export interface CompletePackageDocumentRecord {
  organizationId: string;
  packageId: string;
  documentId: string;
  uploadedAt: Date;
  etag: string | null;
}

export interface DeletePackageDocumentRecord {
  organizationId: string;
  packageId: string;
  documentId: string;
  deletedByEmployeeId: string;
}

export interface PackageDocumentRepositoryContext {
  context?: CommandContext;
}

export interface PackageDocumentUploadIntentResult {
  document: PackageDocumentRecord;
  upload: {
    method: 'PUT';
    url: string;
    headers: Record<string, string>;
    expiresAt: Date;
  };
}

export interface PackageDocumentDownloadResult {
  document: PackageDocumentRecord;
  stream: Readable;
  contentType: string;
  contentLength: number | null;
}
