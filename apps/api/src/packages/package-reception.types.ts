export const PACKAGE_CONDITION_VALUES = [
  'SEALED',
  'OPEN',
  'DAMAGED',
  'WET',
  'CRUSHED',
  'OTHER',
] as const;

export type PackageCondition = (typeof PACKAGE_CONDITION_VALUES)[number];
export type PackageMeasurementUnit = 'LB' | 'KG';
export type PackageDimensionUnit = 'IN' | 'CM';

export interface ReceivePackageInput {
  facilityId: string;
  weight: number;
  length: number;
  width: number;
  height: number;
  pieceCount: number;
  condition: PackageCondition;
}

export interface ReceivePackageRecord {
  organizationId: string;
  packageId: string;
  facilityId: string;
  receivedByEmployeeId: string;
  weight: string;
  length: string;
  width: string;
  height: string;
  pieceCount: number;
  condition: PackageCondition;
}

export interface PackageReceptionRecord {
  id: string;
  organizationId: string;
  packageId: string;
  facility: {
    id: string;
    code: string;
    name: string;
  };
  receivedBy: {
    id: string;
    displayName: string;
  };
  weight: string;
  weightUnit: PackageMeasurementUnit;
  length: string;
  width: string;
  height: string;
  dimensionUnit: PackageDimensionUnit;
  pieceCount: number;
  condition: PackageCondition;
  receivedAt: Date;
  createdAt: Date;
}
