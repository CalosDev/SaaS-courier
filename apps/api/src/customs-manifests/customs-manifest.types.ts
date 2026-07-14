import { CustomsManifestStatus } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';

export type CustomsManifestRecord = {
  id: string;
  organizationId: string;
  code: string;
  dispatchId: string | null;
  flightNumber: string | null;
  arrivalDate: Date | null;
  status: CustomsManifestStatus;
  totalPackages: number;
  totalWeightMinor: bigint;
  totalValueMinor: bigint;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  currentVersion: number;
  finalizedVersionId: string | null;
};

export type CustomsManifestDetailRecord = Prisma.CustomsManifestGetPayload<{
  include: {
    dispatch: {
      include: { originFacility: true; destinationFacility: true };
    };
    versions: { include: { items: true } };
    finalizedVersion: { include: { items: true } };
  };
}>;

export const CUSTOMS_MANIFEST_STATUS_VALUES = Object.values(
  CustomsManifestStatus,
);
