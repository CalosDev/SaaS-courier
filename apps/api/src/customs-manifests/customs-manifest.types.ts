import { CustomsManifestStatus } from '../generated/prisma/client';

export type CustomsManifestRecord = {
  id: string;
  organizationId: string;
  code: string;
  flightNumber: string | null;
  arrivalDate: Date | null;
  status: CustomsManifestStatus;
  totalPackages: number;
  totalWeightMinor: bigint;
  totalValueMinor: bigint;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export const CUSTOMS_MANIFEST_STATUS_VALUES = Object.values(
  CustomsManifestStatus,
);
